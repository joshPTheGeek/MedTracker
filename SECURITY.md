# Security notes

## What we checked (August 2026)

| Source | Status for this project |
|--------|-------------------------|
| **npm registry** (axios, keyv/ChainDrop, AsyncAPI, node-gyp/Miasma, etc.) | Active supply-chain attacks in 2025–2026. **This project does not use npm, `package.json`, or `node_modules`.** |
| **Google Firebase JS CDN** (`https://www.gstatic.com/firebasejs/…`) | No public report of a gstatic Firebase SDK compromise found. Domain is Google-operated. Residual CDN risk remains for any third-party script host. |
| **Firebase Studio CVE-2026-12715** | Patched server-side (Apr 2026). Unrelated to this static Pages + Firestore app. |
| **Your repo** `joshPTheGeek/MedTracker` | Fresh project; not among unrelated third-party “MedTracker” apps. |

## Design choices (minimize downloads)

1. **No npm install** on your machine for this app — avoids the current npm worm ecosystem.
2. **Browser loads Firebase only from Google’s CDN**, pinned version in `js/app.js` (`firebasejs/10.14.1`).
3. **Dashboard password** lives in **Firebase Authentication**, never in GitHub source.
4. **NFC write token** belongs in **Firestore rules** (you deploy in Firebase Console) and on the physical tags — not in public docs as a real value.
5. **Content-Security-Policy** in `index.html` limits scripts to `self` + `https://www.gstatic.com`.

## Your responsibilities

- Keep the GitHub repo **private** if you can (Pages on private repos needs GitHub Pro). If public, still never commit a real write token or Auth password.
- Rotate the NFC write token if a tag is lost or a URL is shared.
- Create **one** Auth account for yourself; do not publish a signup link.
- Prefer pasting Firebase web config yourself into `js/firebase-config.js` (web API keys are public-by-design; Auth + rules enforce access).
