/**
 * MedTracker
 * - NFC tag URL logs a dose and unlocks the whole app (same token)
 * - No email/password — access is the NFC write token
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
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
  latuda: {
    id: "latuda",
    label: "Latuda",
    prompt: {
      kind: "calories",
      title: "Food check",
      message: "Did you eat 300 calories in the last hour?",
    },
  },
  lamotrigine: { id: "lamotrigine", label: "Lamotrigine", prompt: null },
  pantoprazole: {
    id: "pantoprazole",
    label: "Pantoprazole",
    prompt: {
      kind: "wait30",
      title: "Before food",
      message:
        "Pantoprazole is taken in the morning, 30 minutes before food. Will you wait 30 minutes before eating?",
    },
  },
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

const TOKEN_STORAGE_KEY = "medNfc:accessToken";

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
  ["view-home", "view-locked", "view-dashboard", "view-mood"].forEach((id) => hide($(id)));
  show($(name));
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

function requireConfig() {
  if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "PASTE_API_KEY") {
    throw new Error(
      "Firebase is not configured. Add your Firebase web app keys to js/firebase-config.js."
    );
  }
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function hasAccess() {
  return Boolean(getStoredToken());
}

function updateAccessUi() {
  const label = $("access-label");
  if (hasAccess()) {
    label.textContent = "Unlocked by NFC tag";
    show($("lock-btn"));
  } else {
    label.textContent = "Locked — scan a tag to unlock";
    hide($("lock-btn"));
  }
}

let db;
let selectedMoodScore = null;
let selectedEmojis = new Set();

function initFirebase() {
  requireConfig();
  const app = initializeApp(window.FIREBASE_CONFIG);
  db = getFirestore(app);
}

/* ---------- NFC / log flow ---------- */

function promptStorageKey(medId) {
  return `medNfc:prompt:${medId}:${dayKey()}`;
}

function medLoggedStorageKey(medId) {
  return `medNfc:logged:${medId}:${dayKey()}`;
}

function hasPromptAnswerTodayLocal(medId) {
  return localStorage.getItem(promptStorageKey(medId)) === "1";
}

function markPromptAnsweredLocal(medId) {
  localStorage.setItem(promptStorageKey(medId), "1");
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

function askYesNoPrompt({ title, message }) {
  return new Promise((resolve) => {
    const overlay = $("food-overlay");
    $("food-title").textContent = title;
    $("food-message").textContent = message;
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

function confirmDuplicate(medLabel, prior) {
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

function stripTokenFromUrl() {
  const clean = new URL(window.location.href);
  clean.searchParams.delete("token");
  clean.searchParams.delete("t");
  window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
}

async function handleScanLog() {
  const p = params();
  const medId = (p.get("log") || p.get("med") || "").toLowerCase();
  const token = p.get("token") || p.get("t") || "";

  // Token-only URL unlocks the app without logging a dose
  if (token && !medId) {
    storeToken(token);
    updateAccessUi();
    stripTokenFromUrl();
    setView("view-dashboard");
    await loadDashboard();
    return true;
  }

  if (!medId || !token) return false;
  if (!MEDS[medId]) {
    showScanResult({
      ok: false,
      title: "Unknown medication",
      detail: `Tag medication "${medId}" is not recognized. Use latuda, lamotrigine, or pantoprazole.`,
    });
    return true;
  }

  storeToken(token);
  updateAccessUi();

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
          detail: `${MEDS[medId].label} at ${formatWhen(prior.takenAt)}. App unlocked — open History anytime.`,
          medId,
        });
        stripTokenFromUrl();
        return true;
      }
      show($("scan-spinner"));
      $("scan-title").textContent = "Logging…";
    }

    let ateCalories = null;
    let foodAnswered = false;
    let willWait30Min = null;
    let waitPromptAnswered = false;
    let promptNote = "";

    const prompt = MEDS[medId].prompt;
    if (prompt && !hasPromptAnswerTodayLocal(medId)) {
      hide($("scan-spinner"));
      const answer = await askYesNoPrompt(prompt);
      markPromptAnsweredLocal(medId);
      if (prompt.kind === "calories") {
        ateCalories = answer;
        foodAnswered = true;
        promptNote = answer
          ? " Food check: yes, ~300+ calories."
          : " Food check: no.";
      } else if (prompt.kind === "wait30") {
        willWait30Min = answer;
        waitPromptAnswered = true;
        promptNote = answer
          ? " Will wait 30 minutes before eating."
          : " Noted: may not wait 30 minutes before food.";
      }
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
      willWait30Min,
      waitPromptAnswered,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      userAgent: navigator.userAgent.slice(0, 180),
      createdAt: serverTimestamp(),
    });

    markLoggedLocal(medId, takenAt);
    hide($("scan-spinner"));

    showScanResult({
      ok: true,
      title: `${MEDS[medId].label} logged`,
      detail: `${formatWhen(takenAt)}.${promptNote} History and Mood are unlocked on this phone.`,
      medId,
    });
    stripTokenFromUrl();
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

/* ---------- Dashboard ---------- */

async function loadDashboard() {
  const errEl = $("dash-error");
  hide(errEl);
  $("latuda-state").textContent = "Loading…";
  $("lamotrigine-state").textContent = "Loading…";
  $("pantoprazole-state").textContent = "Loading…";
  $("med-log-list").innerHTML = "";
  $("mood-log-list").innerHTML = "";

  try {
    const today = dayKey();
    const medQ = query(collection(db, "medicationLogs"), orderBy("takenAt", "desc"), limit(40));
    const medSnap = await getDocs(medQ);
    const meds = medSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    function fillTodayPill(medId, pillId, stateId) {
      const entry = meds.find((m) => m.medication === medId && m.dayKey === today);
      const pill = $(pillId);
      if (entry) {
        pill.classList.add("taken");
        let extra = "";
        if (entry.ateCalories === true) extra = " · ate";
        if (entry.ateCalories === false) extra = " · no food";
        if (entry.willWait30Min === true) extra = " · wait 30m";
        if (entry.willWait30Min === false) extra = " · no wait";
        $(stateId).textContent = `Taken ${formatWhen(entry.takenAt)}${extra}`;
      } else {
        pill.classList.remove("taken");
        $(stateId).textContent = "Not logged yet today";
      }
    }

    fillTodayPill("latuda", "latuda-pill", "latuda-state");
    fillTodayPill("lamotrigine", "lamotrigine-pill", "lamotrigine-state");
    fillTodayPill("pantoprazole", "pantoprazole-pill", "pantoprazole-state");

    if (meds.length === 0) {
      $("med-log-list").innerHTML = `<li class="empty">No medication logs yet. Scan a tag to create one.</li>`;
    } else {
      $("med-log-list").innerHTML = meds
        .map((m) => {
          let flags = "";
          if (m.ateCalories === true) flags = " · ate 300+ cal";
          else if (m.ateCalories === false) flags = " · no food flag";
          if (m.willWait30Min === true) flags = " · wait 30 min before food";
          else if (m.willWait30Min === false) flags = " · no wait before food";
          return `<li>
            <div>
              <div class="title">${m.medicationLabel || m.medication}</div>
              <div class="sub">${m.dayKey}${flags}</div>
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
        ? "Firestore denied read access. Publish the updated firestore.rules (reads no longer need email login)."
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
  const token = getStoredToken();
  if (!token) {
    setView("view-locked");
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
      token,
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

function requireAccessOrLock(view) {
  if (!hasAccess()) {
    setView("view-locked");
    return false;
  }
  setView(view);
  return true;
}

function wireUi() {
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view === "view-dashboard") {
        if (requireAccessOrLock(view)) loadDashboard();
        return;
      }
      if (view === "view-mood") {
        if (requireAccessOrLock(view)) renderMoodControls();
        return;
      }
      setView(view);
      if (view === "view-home") {
        show($("home-default"));
        hide($("home-scan-result"));
      }
    });
  });

  $("lock-btn").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    updateAccessUi();
    setView("view-home");
    show($("home-default"));
    hide($("home-scan-result"));
  });

  $("mood-save").addEventListener("click", () => saveMood());
  $("open-dashboard").addEventListener("click", () => {
    if (requireAccessOrLock("view-dashboard")) loadDashboard();
  });
}

async function main() {
  const bootError = $("boot-error");
  try {
    initFirebase();
  } catch (err) {
    show(bootError);
    bootError.textContent = err.message;
    $("access-label").textContent = "Firebase not configured";
    setView("view-home");
    show($("home-default"));
    hide($("home-scan-result"));
    wireUi();
    return;
  }

  wireUi();
  renderMoodControls();
  updateAccessUi();

  const handled = await handleScanLog();
  if (!handled) {
    setView("view-home");
    show($("home-default"));
    hide($("home-scan-result"));
  }
}

main();
