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

## Tag 3 — Pantoprazole

```text
https://joshPTheGeek.github.io/MedTracker/?log=pantoprazole&token=YOUR_WRITE_TOKEN
```

Morning dose. Asks once per day: **Will you wait 30 minutes before eating?** then saves date/time.

## Steps in NFC Tools

1. Open **NFC Tools** → **Write** / **Add a record**.
2. Choose **URL / URI**.
3. Paste each URL above onto its own tag.
4. Label the physical tags so you do not mix them up.

## Rules

| Item | Value |
|------|--------|
| Site | `https://joshPTheGeek.github.io/MedTracker/` |
| Token | Same on all tags + in Firestore rules |
| Sign-in to log | **Not required** |

## Generate a token (PowerShell, no downloads)

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

## Test without a physical tag

Open any medication URL in your phone browser after Pages + Firebase are live.
