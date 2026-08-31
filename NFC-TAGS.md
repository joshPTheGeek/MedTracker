# What to write on your NFC tags

Use **NFC Tools** → **Add a record** → **URL / URI** (not Text / Phone / Wi‑Fi).

Replace `YOUR_WRITE_TOKEN` with the same long secret you put in Firebase `firestore.rules`.

## Tag 1 — Latuda

```text
https://joshPTheGeek.github.io/MedTracker/?log=latuda&token=YOUR_WRITE_TOKEN
```

Asks once per day: **Did you eat 300 calories in the last hour?** then saves date/time.

## Tag 2 — Lamotrigine

```text
https://joshPTheGeek.github.io/MedTracker/?log=lamotrigine&token=YOUR_WRITE_TOKEN
```

Logs date/time only (no food prompt).

## Steps in NFC Tools

1. Open **NFC Tools** → **Write** / **Add a record**.
2. Choose **URL / URI**.
3. Paste the Latuda URL → write to the first tag.
4. Repeat with the Lamotrigine URL on the second tag.
5. Label the physical tags so you do not mix them up.

## Rules

| Item | Value |
|------|--------|
| Site | `https://joshPTheGeek.github.io/MedTracker/` |
| Token | Same on both tags + in Firestore rules |
| Password | **Not** on the tag — only for viewing History/Mood |
| Sign-in to log | **Not required** |

## Generate a token (PowerShell, no downloads)

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

## Test without a physical tag

Open the Latuda URL in your phone browser after Pages + Firebase are live.
