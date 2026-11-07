# Privacy and your data

## Where your data lives

All records are stored in **your browser’s IndexedDB on this device**. There is no account,
no server, no analytics and no network request that carries your records anywhere. The app
is a static website: it downloads its own code once (via the service worker) and then runs
from your device.

## What leaves the device

Nothing, unless you act:

- **Backup download** writes a JSON file to your own downloads folder.
- **CSV export** in Report Studio writes a file to your own downloads folder.
- Loading the app itself downloads the app files (HTML/JS/CSS/icons) from the host
  (GitHub Pages). That request contains no data about you.

There is no telemetry, no crash reporting and no third-party script.

## What you should record

Dates, times, durations, categories, locations such as “campus clinic”, and short titles.

**Do not enter client names, diagnoses, session content, or any confidential health
information.** The tracker is not a medical record system and is not designed to hold
sensitive clinical detail. Titles and notes are free text, so what you type is what is
stored — in plaintext, readable by anyone with access to your browser profile.

## How this app differs from a compliance system

- Targets are numbers **you** entered. A **Target reached** badge means you passed the
  number you configured — nothing more.
- The app applies no licensure rules, no jurisdiction logic and no board requirements.
- It makes no claim about HIPAA, GDPR or any other regulatory framework, and it cannot
  certify compliance. Confirmation comes from your program or licensing board.

## If you share this device

Anyone with access to your browser profile can open the app and read your records. Use the
browser’s profile lock, or log out of the profile, if you share a computer. You can also
download a backup and then **Erase all data on this device**.

## Deleting everything

Settings & Help → **Erase all data on this device** removes all activities, CEUs, targets,
categories and settings from this browser after a confirmation. Back up first if you might
need the records. Deleting the browser’s site data for this site has the same effect.

## About backups

Backup files are unencrypted JSON. Treat them like any document containing personal notes:
store them somewhere private, and delete old copies you no longer need.
