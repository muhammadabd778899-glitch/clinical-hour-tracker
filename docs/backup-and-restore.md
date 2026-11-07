# Backup and restore

Your records exist in one place only: this browser’s IndexedDB on this device. A backup file
is the only way to move them to another computer, keep them safe after clearing browser
data, or recover from a mistake.

## Creating a backup

**Settings & Help → Download full backup (JSON)** downloads a file named like
`clinical-tracker-backup-2026-03-05-1430.json`.

The file is plain JSON and contains:

- activities, categories, targets (requirements) and renewal periods
- CEU records
- your settings and app metadata

It contains no client information (the app never stores any) and is not encrypted — store it
somewhere you control.

## Restoring

1. Open **Settings & Help**.
2. Under *Restore from a backup file*, choose your `.json` file.
3. A **Restore preview** appears showing how many records of each kind are in the file and
   how many match records already on this device. Nothing has been written yet.
4. Choose a mode:
   - **Replace everything** — deletes what is on this device, then imports the backup
     exactly as it was saved.
   - **Merge with existing data** — keeps your current records and adds the backup;
     records with the same id are updated from the backup.
5. Press **Restore now**. A confirmation tells you how many records were written.

### Safety guarantees

- The whole file is validated (format version, schema, every record) **before** any write.
- The import runs in a single database transaction. If anything fails, the transaction
  rolls back and **your existing data is left exactly as it was**.
- An unreadable file, a file from another app, or a file from a newer format version is
  rejected with a plain-language reason — again with no changes made.

## Format and versions

Backups carry `format: "clinical-hour-tracker-backup"` and `version: 1`, plus the internal
`schemaVersion` of the database at export time. Older files are migrated on restore; files
newer than the app understands are refused with a message telling you to update the app
rather than being partially imported.

## Moving to another device

1. On the old device: Settings → Download full backup.
2. Copy the file to the new device (cable, cloud drive you trust, USB stick).
3. On the new device: install/open the app → Settings → choose the file → preview → restore.

## Recovering after "my data is gone"

Data disappears when browser site data is cleared, a different browser or profile is used,
or a private-browsing window closes. Check the obvious first (same browser, same profile),
then restore from your most recent backup — anything logged after that backup will not be in
the file, so keep backups frequent.

## Erasing everything

**Settings → Erase all data on this device** removes all activities, CEUs, targets and
settings from this browser after a confirmation. It cannot be undone. Back up first.
