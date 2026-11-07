# Troubleshooting

## “My records are missing”

1. Confirm you are in the **same browser and profile** you normally use (data never
   leaves the device, so another browser or computer has none of it).
2. Check whether you are in a **private/incognito window** — those discard data when they
   close.
3. Open **Settings & Help → Data & storage**. If storage reads *Unavailable*, allow site
   data for this page and reload.
4. Restore your newest backup: Settings → *Restore from a backup file*.

## Storage status shows “Unavailable”

Usually private browsing, “block third-party cookies/site data”, or a browser with storage
disabled. Allow site data for this site, then reload. The app still opens so you can read
the message, but records cannot be saved until storage works.

## The Offline badge is showing

That is expected without a connection: it means the page is running from the service worker
and your data is still being written to this device. Logging, editing and reports all keep
working offline. The badge disappears when the connection returns.

## The app looks outdated after an update

The service worker updates in the background and refreshes on the next load. If something
looks stale: pull to refresh / hard reload (Ctrl+Shift+R). Your records are unaffected —
they are in IndexedDB, not in the app files.

## A restore failed

- “This file was not created by All in One Clinical Tracker” — you chose a different JSON
  file.
- “This backup uses format version … Update the app before restoring” — the file came from
  a newer version of the app.
- “The backup failed validation (…)” — a record in the file does not satisfy the schema;
  the message says which part failed.

In every case **nothing was written**: the transaction is all-or-nothing, so your existing
records are still there.

## A link says “Record not found”

The record id no longer exists — it was deleted, or the link came from another device.
Use **Back to Activity Log** and find the current record.

## Opening a deep link lands on the Overview

Hash links look like `https://…/clinical-hour-tracker/#/activities`. If the `#` part is
missing, the app starts at the Overview. Copy the whole address including the `#…`.

## End-to-end tests fail to start

- `Executable doesn't exist …` → `npx playwright install chromium`.
- `ENOSPC` while downloading browsers → the drive is full; install browsers elsewhere with
  `PLAYWRIGHT_BROWSERS_PATH=/path/with/space npx playwright install chromium`.
- Port already in use → stop the other server; Playwright expects `127.0.0.1:4173`.

## Build or type errors

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run them in that order; each one is independent and the first failure is usually the cause
of the rest.

## Getting a clean slate while developing

Delete the site’s data for `localhost` (browser site-data settings) or run
**Settings → Erase all data on this device**, then reload to see the welcome screen again.
