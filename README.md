# MedTracker

Personal web app: tap an NFC tag → log **Latuda** or **Lamotrigine** (date + time). View history and use an on-demand mood tracker after signing in.

- **GitHub:** [joshPTheGeek/MedTracker](https://github.com/joshPTheGeek/MedTracker)
- **Site (after you enable Pages):** https://joshPTheGeek.github.io/MedTracker/
- **Firebase project:** `medtracker-a0fe7`

## Features

- NFC scan logs **without signing in** (write token on the tag URL)
- Separate tags for Latuda and Lamotrigine
- Latuda only: once per day asks *“Did you eat 300 calories in the last hour?”*
- History of doses with day and time
- Mood tracker: 1–10 scale + emoji tags + optional note
- Dashboard password via **Firebase Auth** (not hardcoded in this repo)

## Docs

| File | Purpose |
|------|---------|
| [`SETUP.md`](SETUP.md) | Firebase Auth, Firestore rules, GitHub Pages |
| [`NFC-TAGS.md`](NFC-TAGS.md) | Exact URLs to write with NFC Tools |
| [`SECURITY.md`](SECURITY.md) | Supply-chain checks and threat model |

## Security posture

This app uses **no npm packages**. The browser loads a **pinned** Firebase SDK from Google’s CDN (`www.gstatic.com`). See [`SECURITY.md`](SECURITY.md).

## After clone / push

1. Fill in `js/firebase-config.js` from Firebase Console → Project settings → Web app.
2. Publish `firestore.rules` (replace `WRITE_TOKEN_HERE`) in Firebase Console.
3. Enable GitHub Pages on branch `main` / root.
4. Create your Auth account from the site’s **Create account** once.
5. Write NFC tags per [`NFC-TAGS.md`](NFC-TAGS.md).

## Disclaimer

Personal adherence tool — not a substitute for medical advice or emergency care.
