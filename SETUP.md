# Setup — joshPTheGeek/MedTracker + Firebase `medtracker-a0fe7`

Repo is already on GitHub. Complete Firebase + Pages below. **No npm install is required.**

## 1. Turn on GitHub Pages (you do this)

1. Open https://github.com/joshPTheGeek/MedTracker/settings/pages  
2. Source: **Deploy from a branch**  
3. Branch: **main** → folder **/** (root) → Save  
4. Site URL: https://joshPTheGeek.github.io/MedTracker/

## 2. Firebase web app config

1. Open https://console.firebase.google.com/project/medtracker-a0fe7/settings/general/  
2. Under **Your apps**, add a **Web** app if you have not already.  
3. Copy the config into `js/firebase-config.js` (apiKey, messagingSenderId, appId, etc.).  
4. Commit and push that file when ready (web API keys are public-by-design; Auth + rules protect data).

Suggested `authDomain` / `projectId` / `storageBucket` already match `medtracker-a0fe7` in the placeholder file.

## 3. Enable Authentication

1. https://console.firebase.google.com/project/medtracker-a0fe7/authentication/providers  
2. Enable **Email/Password**.  
3. On the live site → **Sign in** → **Create account** (once, for you only).

## 4. Create Firestore

1. https://console.firebase.google.com/project/medtracker-a0fe7/firestore  
2. Create database (production mode) if needed.  
3. Open **Rules**, paste the contents of `firestore.rules` from this repo.  
4. Replace `WRITE_TOKEN_HERE` with your real token (same as on NFC tags).  
5. **Publish**.

## 5. Write NFC tags

See [`NFC-TAGS.md`](NFC-TAGS.md).

## 6. Verify

1. Open Latuda test URL → food prompt → success.  
2. Sign in → **History** shows the dose.  
3. Scan physical tags.  
4. Save a mood entry.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Firebase not configured | Fill `js/firebase-config.js` and push |
| permission-denied on scan | Token mismatch or rules not published |
| permission-denied on History | Sign in; confirm rules allow authenticated read |
| Pages 404 | Enable Pages on `main` / root; wait a minute |
