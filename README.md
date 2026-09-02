# MedTracker

Personal web app: tap an NFC tag → log **Latuda**, **Lamotrigine**, or **Pantoprazole** (date + time). View history and use an on-demand mood tracker.

Tracks the medications I am taking.

- **GitHub:** [joshPTheGeek/MedTracker](https://github.com/joshPTheGeek/MedTracker)
- **Site (after you enable Pages):** https://joshPTheGeek.github.io/MedTracker/
- **Firebase project:** `medtracker-a0fe7`

## Features

- NFC scan logs **without signing in** (write token on the tag URL)
- Separate tags for Latuda, Lamotrigine, and Pantoprazole
- Latuda: once per day asks *“Did you eat 300 calories in the last hour?”*
- Pantoprazole: once per day asks *“Will you wait 30 minutes before eating?”*
- History of doses with day and time
- Mood tracker: 1–10 scale + emoji tags + optional note
- **No email/password** — scanning a tag unlocks History and Mood on that phone

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
4. Write NFC tags per [`NFC-TAGS.md`](NFC-TAGS.md).

## Disclaimer

Personal adherence tool — not a substitute for medical advice or emergency care.
