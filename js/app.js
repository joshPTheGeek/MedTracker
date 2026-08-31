/**
 * Medication NFC Logger
 * - NFC tag URLs log doses without signing in (token in URL)
 * - Dashboard / mood tracker require Firebase Auth (password never in source)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const MEDS = {
  latuda: { id: "latuda", label: "Latuda", needsFoodPrompt: true },
  lamotrigine: { id: "lamotrigine", label: "Lamotrigine", needsFoodPrompt: false },
};

const MOOD_EMOJIS = [
  { id: "great", label: "😊 Great" },
  { id: "okay", label: "🙂 Okay" },
  { id: "low", label: "😔 Low" },
  { id: "anxious", label: "😰 Anxious" },
  { id: "irritable", label: "😤 Irritable" },
  { id: "tired", label: "😴 Tired" },
  { id: "calm", label: "😌 Calm" },
];

function $(id) {
  return document.getElementById(id);
}

function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWhen(isoOrDate) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function params() {
  return new URLSearchParams(window.location.search);
}

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function setView(name) {
  ["view-home", "view-login", "view-dashboard", "view-mood"].forEach((id) => hide($(id)));
  show($(name));
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

function requireConfig() {
  if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "PASTE_API_KEY") {
    throw new Error(
      "Firebase is not configured. Copy js/firebase-config.example.js to js/firebase-config.js and add your Firebase web app keys."
    );
  }
}

let app, auth, db;
let currentUser = null;
let selectedMoodScore = null;
let selectedEmojis = new Set();

function initFirebase() {
  requireConfig();
  app = initializeApp(window.FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
}

/* ---------- NFC / log flow ---------- */
/*
 * Scan logging must work while signed out. Firestore reads require Auth,
 * so "once per day" UX for food / duplicate hints uses localStorage on this phone.
 * The dashboard (signed in) remains the durable source of truth in Firestore.
 */

function foodPromptStorageKey() {
  return `medNfc:foodPrompt:${dayKey()}`;
}

function medLoggedStorageKey(medId) {
  return `medNfc:logged:${medId}:${dayKey()}`;
}

function hasFoodAnswerTodayLocal() {
  return localStorage.getItem(foodPromptStorageKey()) === "1";
}

function markFoodAnsweredLocal() {
  localStorage.setItem(foodPromptStorageKey(), "1");
}

function priorLogTodayLocal(medId) {
  const raw = localStorage.getItem(medLoggedStorageKey(medId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { takenAt: raw };
  }
}

function markLoggedLocal(medId, takenAt) {
  localStorage.setItem(medLoggedStorageKey(medId), JSON.stringify({ takenAt }));
}

function askFoodPrompt() {
  return new Promise((resolve) => {
    const overlay = $("food-overlay");
    show(overlay);
    const cleanup = (value) => {
      hide(overlay);
      $("food-yes").onclick = null;
      $("food-no").onclick = null;
      resolve(value);
    };
    $("food-yes").onclick = () => cleanup(true);
    $("food-no").onclick = () => cleanup(false);
  });
}

async function confirmDuplicate(medLabel, prior) {
  return new Promise((resolve) => {
    const overlay = $("dup-overlay");
    $("dup-message").textContent = `${medLabel} was already logged today at ${formatWhen(
      prior.takenAt
    )}. Log again?`;
    show(overlay);
    const cleanup = (value) => {
      hide(overlay);
      $("dup-yes").onclick = null;
      $("dup-no").onclick = null;
      resolve(value);
    };
    $("dup-yes").onclick = () => cleanup(true);
    $("dup-no").onclick = () => cleanup(false);
  });
}

function showScanResult({ ok, title, detail, medId }) {
  setView("view-home");
  hide($("home-default"));
  show($("home-scan-result"));
  $("scan-title").textContent = title;
  $("scan-detail").textContent = detail;
  const icon = $("scan-icon");
  icon.className = `status-icon ${ok ? "ok" : "warn"}`;
  icon.textContent = ok ? "✓" : "!";
  const badge = $("scan-med-badge");
  if (medId && MEDS[medId]) {
    badge.className = `med-badge ${medId}`;
    badge.textContent = MEDS[medId].label;
    show(badge);
  } else {
    hide(badge);
  }
}

async function handleScanLog() {
  const p = params();
  const medId = (p.get("log") || p.get("med") || "").toLowerCase();
  const token = p.get("token") || p.get("t") || "";

  if (!medId || !token) return false;
  if (!MEDS[medId]) {
    showScanResult({
      ok: false,
      title: "Unknown medication",
      detail: `Tag medication "${medId}" is not recognized. Use latuda or lamotrigine.`,
    });
    return true;
  }

  setView("view-home");
  hide($("home-default"));
  show($("home-scan-result"));
  $("scan-icon").className = "status-icon info";
  $("scan-icon").textContent = "…";
  $("scan-title").textContent = "Logging…";
  $("scan-detail").textContent = `Saving ${MEDS[medId].label}…`;
  show($("scan-spinner"));
  hide($("scan-med-badge"));

  try {
    const prior = priorLogTodayLocal(medId);
    if (prior) {
      hide($("scan-spinner"));
      const again = await confirmDuplicate(MEDS[medId].label, prior);
      if (!again) {
        showScanResult({
          ok: true,
          title: "Already logged",
          detail: `${MEDS[medId].label} at ${formatWhen(prior.takenAt)}. No new entry saved.`,
          medId,
        });
        return true;
      }
      show($("scan-spinner"));
      $("scan-title").textContent = "Logging…";
    }

    let ateCalories = null;
    let foodAnswered = false;

    if (MEDS[medId].needsFoodPrompt && !hasFoodAnswerTodayLocal()) {
      hide($("scan-spinner"));
      ateCalories = await askFoodPrompt();
      foodAnswered = true;
      markFoodAnsweredLocal();
      show($("scan-spinner"));
      $("scan-title").textContent = "Saving…";
    }

    const takenAt = new Date().toISOString();
    await addDoc(collection(db, "medicationLogs"), {
      medication: medId,
      medicationLabel: MEDS[medId].label,
      takenAt,
      dayKey: dayKey(),
      token,
      ateCalories,
      foodAnswered,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      userAgent: navigator.userAgent.slice(0, 180),
      createdAt: serverTimestamp(),
    });

    markLoggedLocal(medId, takenAt);

    hide($("scan-spinner"));
    const foodLine =
      ateCalories === null
        ? ""
        : ateCalories
          ? " Food check: yes, ~300+ calories."
          : " Food check: no.";
    showScanResult({
      ok: true,
      title: `${MEDS[medId].label} logged`,
      detail: `${formatWhen(takenAt)}.${foodLine} You can close this page.`,
      medId,
    });

    // Clean token from address bar so it is less likely to linger in history
    const clean = new URL(window.location.href);
    clean.searchParams.delete("token");
    clean.searchParams.delete("t");
    window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
  } catch (err) {
    console.error(err);
    hide($("scan-spinner"));
    showScanResult({
      ok: false,
      title: "Could not save",
      detail:
        err?.code === "permission-denied"
          ? "Firebase rejected the write. Check that your NFC token matches firestore.rules and that rules are published."
          : err?.message || "Unknown error while saving the log.",
      medId,
    });
  }

  return true;
}

/* ---------- Auth / dashboard ---------- */

async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

async function register(email, password) {
  await createUserWithEmailAndPassword(auth, email, password);
}

async function logout() {
  await signOut(auth);
}

async function loadDashboard() {
  const errEl = $("dash-error");
  hide(errEl);
  $("latuda-state").textContent = "Loading…";
  $("lamotrigine-state").textContent = "Loading…";
  $("med-log-list").innerHTML = "";
  $("mood-log-list").innerHTML = "";

  try {
    const today = dayKey();
    const medQ = query(
      collection(db, "medicationLogs"),
      orderBy("takenAt", "desc"),
      limit(40)
    );
    const medSnap = await getDocs(medQ);
    const meds = medSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const latudaToday = meds.find((m) => m.medication === "latuda" && m.dayKey === today);
    const lamToday = meds.find((m) => m.medication === "lamotrigine" && m.dayKey === today);

    const latudaPill = $("latuda-pill");
    const lamPill = $("lamotrigine-pill");
    if (latudaToday) {
      latudaPill.classList.add("taken");
      let food = "";
      if (latudaToday.ateCalories === true) food = " · ate";
      if (latudaToday.ateCalories === false) food = " · no food";
      $("latuda-state").textContent = `Taken ${formatWhen(latudaToday.takenAt)}${food}`;
    } else {
      latudaPill.classList.remove("taken");
      $("latuda-state").textContent = "Not logged yet today";
    }
    if (lamToday) {
      lamPill.classList.add("taken");
      $("lamotrigine-state").textContent = `Taken ${formatWhen(lamToday.takenAt)}`;
    } else {
      lamPill.classList.remove("taken");
      $("lamotrigine-state").textContent = "Not logged yet today";
    }

    if (meds.length === 0) {
      $("med-log-list").innerHTML = `<li class="empty">No medication logs yet. Scan a tag to create one.</li>`;
    } else {
      $("med-log-list").innerHTML = meds
        .map((m) => {
          const food =
            m.ateCalories === true
              ? " · ate 300+ cal"
              : m.ateCalories === false
                ? " · no food flag"
                : "";
          return `<li>
            <div>
              <div class="title">${m.medicationLabel || m.medication}</div>
              <div class="sub">${m.dayKey}${food}</div>
            </div>
            <div class="time">${formatWhen(m.takenAt)}</div>
          </li>`;
        })
        .join("");
    }

    const moodQ = query(collection(db, "moodLogs"), orderBy("createdAtClient", "desc"), limit(20));
    const moodSnap = await getDocs(moodQ);
    const moods = moodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (moods.length === 0) {
      $("mood-log-list").innerHTML = `<li class="empty">No mood entries yet.</li>`;
    } else {
      $("mood-log-list").innerHTML = moods
        .map((m) => {
          const tags = (m.emojis || []).join(", ");
          const note = m.note ? ` · ${escapeHtml(m.note)}` : "";
          return `<li>
            <div>
              <div class="title">Mood ${m.moodScore}/10${tags ? ` · ${escapeHtml(tags)}` : ""}</div>
              <div class="sub">${m.dayKey}${note}</div>
            </div>
            <div class="time">${formatWhen(m.createdAtClient)}</div>
          </li>`;
        })
        .join("");
    }
  } catch (err) {
    console.error(err);
    show(errEl);
    errEl.textContent =
      err?.code === "permission-denied"
        ? "Signed in, but Firestore denied read access. Publish firestore.rules and wait a minute."
        : err?.message || "Failed to load logs.";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Mood ---------- */

function renderMoodControls() {
  const scale = $("mood-scale");
  scale.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(i);
    btn.classList.toggle("selected", selectedMoodScore === i);
    btn.onclick = () => {
      selectedMoodScore = i;
      renderMoodControls();
    };
    scale.appendChild(btn);
  }

  const row = $("emoji-row");
  row.innerHTML = "";
  MOOD_EMOJIS.forEach((e) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "emoji-chip" + (selectedEmojis.has(e.id) ? " selected" : "");
    chip.textContent = e.label;
    chip.onclick = () => {
      if (selectedEmojis.has(e.id)) selectedEmojis.delete(e.id);
      else selectedEmojis.add(e.id);
      renderMoodControls();
    };
    row.appendChild(chip);
  });
}

async function saveMood() {
  const errEl = $("mood-error");
  hide(errEl);
  if (!currentUser) {
    show(errEl);
    errEl.textContent = "Sign in to save a mood entry.";
    return;
  }
  if (!selectedMoodScore) {
    show(errEl);
    errEl.textContent = "Pick a mood score from 1 to 10.";
    return;
  }

  const note = $("mood-note").value.trim();
  const createdAtClient = new Date().toISOString();
  $("mood-save").disabled = true;
  try {
    await addDoc(collection(db, "moodLogs"), {
      moodScore: selectedMoodScore,
      emojis: Array.from(selectedEmojis).map(
        (id) => MOOD_EMOJIS.find((e) => e.id === id)?.label || id
      ),
      note,
      dayKey: dayKey(),
      createdAtClient,
      createdAt: serverTimestamp(),
      uid: currentUser.uid,
    });
    $("mood-note").value = "";
    selectedMoodScore = null;
    selectedEmojis = new Set();
    renderMoodControls();
    $("mood-success").textContent = `Saved mood at ${formatWhen(createdAtClient)}.`;
    show($("mood-success"));
    setTimeout(() => hide($("mood-success")), 4000);
  } catch (err) {
    console.error(err);
    show(errEl);
    errEl.textContent = err?.message || "Could not save mood.";
  } finally {
    $("mood-save").disabled = false;
  }
}

/* ---------- Wire UI ---------- */

function wireUi() {
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if ((view === "view-dashboard" || view === "view-mood") && !currentUser) {
        setView("view-login");
        return;
      }
      setView(view);
      if (view === "view-dashboard") loadDashboard();
      if (view === "view-mood") renderMoodControls();
    });
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error");
    hide(err);
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    $("login-submit").disabled = true;
    try {
      await login(email, password);
    } catch (ex) {
      show(err);
      err.textContent = ex?.message || "Sign-in failed.";
    } finally {
      $("login-submit").disabled = false;
    }
  });

  $("register-btn").addEventListener("click", async () => {
    const err = $("login-error");
    hide(err);
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    if (password.length < 8) {
      show(err);
      err.textContent = "Use a password of at least 8 characters.";
      return;
    }
    $("register-btn").disabled = true;
    try {
      await register(email, password);
    } catch (ex) {
      show(err);
      err.textContent =
        ex?.code === "auth/operation-not-allowed"
          ? "Enable Email/Password sign-in in Firebase Authentication."
          : ex?.message || "Could not create account.";
    } finally {
      $("register-btn").disabled = false;
    }
  });

  $("logout-btn").addEventListener("click", () => logout());
  $("mood-save").addEventListener("click", () => saveMood());
  $("open-dashboard").addEventListener("click", () => {
    if (currentUser) {
      setView("view-dashboard");
      loadDashboard();
    } else {
      setView("view-login");
    }
  });
}

async function main() {
  const bootError = $("boot-error");
  try {
    initFirebase();
  } catch (err) {
    show(bootError);
    bootError.textContent = err.message;
    $("auth-label").textContent = "Firebase not configured";
    setView("view-home");
    show($("home-default"));
    hide($("home-scan-result"));
    wireUi();
    return;
  }

  wireUi();
  renderMoodControls();

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authLabel = $("auth-label");
    if (user) {
      authLabel.textContent = user.email || "Signed in";
      show($("logout-btn"));
      hide($("nav-login"));
    } else {
      authLabel.textContent = "Not signed in";
      hide($("logout-btn"));
      show($("nav-login"));
    }
  });

  const handled = await handleScanLog();
  if (!handled) {
    setView("view-home");
    show($("home-default"));
    hide($("home-scan-result"));
  }
}

main();
