# Setup — joshPTheGeek/MedTracker + Firebase `medtracker-a0fe7`

**No email/password login.** Access comes from your NFC write token after you scan a tag.

## 1. Turn on GitHub Pages

1. https://github.com/joshPTheGeek/MedTracker/settings/pages  
2. Deploy from branch **main** / folder **/**  
3. Site: https://joshPTheGeek.github.io/MedTracker/

## 2. Firebase web app config

1. https://console.firebase.google.com/project/medtracker-a0fe7/settings/general/  
2. Add a **Web** app if needed → paste keys into `js/firebase-config.js` → commit/push.

You do **not** need Firebase Authentication for this app.

## 3. Create Firestore + publish rules

1. https://console.firebase.google.com/project/medtracker-a0fe7/firestore  
2. Create database (production mode) if needed.  
3. **Rules** → paste `firestore.rules` → replace `WRITE_TOKEN_HERE` with your token → **Publish**.

## 4. Write NFC tags

See [`NFC-TAGS.md`](NFC-TAGS.md). Same token on both tags.

After one successful scan, History and Mood stay unlocked on that phone until you tap **Lock**.

## 5. Verify

1. Open a Latuda tag URL → food prompt → success.  
2. Open **History** (no sign-in).  
3. Save a mood entry.
