import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge, Spinner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSettings } from '@/hooks/useData';
import { updateSettings } from '@/services/settings';
import { SampleSettingsCard } from '@/components/sample/SampleWorkspace';
import {
  createBackup,
  parseBackup,
  previewRestore,
  restoreBackup,
  type Backup,
  type RestoreMode,
  type RestorePreview,
} from '@/services/backup';
import { downloadJson as downloadFile, fileTimestamp } from '@/services/export';
import { eraseAllData } from '@/services/maintenance';
import { isStorageAvailable, storageEstimate } from '@/db/database';
import { ServiceError } from '@/services/errors';
import { formatTimestamp } from '@/domain/date';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Settings & Help — profile, backup/restore, storage and documentation. */
export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const online = useOnlineStatus();

  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('');
  const [includeSupervision, setIncludeSupervision] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{ backup: Backup; preview: RestorePreview } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace');
  const [restoring, setRestoring] = useState(false);

  const [storageOk, setStorageOk] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number | null; quota: number | null }>({
    usage: null,
    quota: null,
  });

  const [eraseOpen, setEraseOpen] = useState(false);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDisplayName(settings.displayName);
    setProfession(settings.profession);
    setIncludeSupervision(settings.includeSupervisionInClinicalTotal);
  }, [settings]);

  useEffect(() => {
    void isStorageAvailable().then(setStorageOk);
    void storageEstimate().then(setEstimate);
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await updateSettings({
        displayName: displayName.trim(),
        profession: profession.trim(),
        includeSupervisionInClinicalTotal: includeSupervision,
      });
      toast.success('Settings saved.');
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not save your settings.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const backup = await createBackup();
      downloadFile(`clinical-tracker-backup-${fileTimestamp()}.json`, backup);
      toast.success('Backup downloaded. Keep it somewhere safe.');
    } catch {
      toast.error('We could not create the backup file. Please try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    setRestoreError(null);
    try {
      const text = await file.text();
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setRestoreError(parsed.message);
        return;
      }
      const preview = await previewRestore(parsed.backup);
      setPendingRestore({ backup: parsed.backup, preview });
      setRestoreMode('replace');
    } catch {
      setRestoreError('We could not read that file. Choose a backup file created by this app.');
    }
  };

  const performRestore = async () => {
    if (!pendingRestore || restoring) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(pendingRestore.backup, restoreMode);
      toast.success(
        `Restore complete: ${result.written.activities} activities, ${result.written.ceus} CEU records, ${result.written.requirements} targets.`,
      );
      setPendingRestore(null);
      setRestoreError(null);
      void storageEstimate().then(setEstimate);
    } catch (error) {
      setRestoreError(
        error instanceof ServiceError
          ? error.message
          : 'The restore did not complete, so nothing was changed. Your existing data is still safe.',
      );
      setPendingRestore(null);
    } finally {
      setRestoring(false);
    }
  };

  const handleErase = async () => {
    if (erasing) return;
    setErasing(true);
    try {
      await eraseAllData();
      toast.success('All local data erased.');
      window.location.hash = '#/welcome';
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not erase the data.');
      setErasing(false);
      setEraseOpen(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings & Help"
        eyebrow="Your workspace"
        description="Your profile, backups, storage information and answers to common questions."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <h2>Profile &amp; preferences</h2>
          <form onSubmit={saveProfile} className="mt-3 space-y-4">
            <Field label="Display name" htmlFor="set-name" hint="Stored only on this device.">
              <Input
                id="set-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
            </Field>
            <Field label="Role" htmlFor="set-profession">
              <Select id="set-profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
                <option value="">Choose…</option>
                <option>Counseling / psychology student</option>
                <option>Social work student or intern</option>
                <option>Clinical trainee</option>
                <option>Licensure candidate</option>
                <option>Licensed professional</option>
                <option>Other</option>
              </Select>
            </Field>

            <label className="flex items-start gap-2 rounded-lg border border-app-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-app-primary"
                checked={includeSupervision}
                onChange={(e) => setIncludeSupervision(e.target.checked)}
              />
              <span>
                <strong>Count supervision toward total clinical hours.</strong>
                <br />
                <span className="text-app-muted">
                  Off by default: supervision is tracked separately. Turn this on only if your program counts
                  supervision inside your clinical-hour total.
                </span>
              </span>
            </label>

            <Button type="submit" loading={savingProfile}>
              Save settings
            </Button>
          </form>
        </Card>

        <SampleSettingsCard />

        {/* Backup */}
        <Card>          <div className="flex items-center justify-between">
            <h2>Backup &amp; restore</h2>
            <Badge tone={online ? 'success' : 'warning'}>{online ? 'Online' : 'Offline'}</Badge>
          </div>
          <p className="mt-1 text-sm text-app-muted">
            Your records exist only in this browser. Download a backup regularly — it is the only way to move your
            data to another device or recover after clearing browser data.
          </p>

          <div className="mt-3 space-y-2">
            <Button onClick={() => void handleDownloadBackup()} loading={backupBusy}>
              Download full backup (JSON)
            </Button>

            <div>
              <label htmlFor="restore-file" className="label">
                Restore from a backup file
              </label>
              <input
                id="restore-file"
                type="file"
                accept="application/json,.json"
                className="block w-full text-sm text-app-muted file:mr-3 file:rounded-lg file:border file:border-app-border file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-50"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleRestoreFile(file);
                  e.target.value = '';
                }}
              />
              <p className="hint">Nothing is changed until you confirm the preview.</p>
            </div>

            {restoreError && (
              <p className="rounded-lg bg-app-danger-light px-3 py-2 text-sm text-app-danger" role="alert">
                {restoreError}
              </p>
            )}
          </div>
        </Card>

        {/* Storage */}
        <Card>
          <h2>Data &amp; storage</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-app-muted">Storage status</dt>
              <dd>
                {storageOk === null ? (
                  <Spinner label="Checking…" />
                ) : storageOk ? (
                  <Badge tone="success">Available</Badge>
                ) : (
                  <Badge tone="danger">Unavailable</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-app-muted">Approximate usage</dt>
              <dd className="font-medium">{formatBytes(estimate.usage)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-app-muted">Browser quota</dt>
              <dd className="font-medium">{formatBytes(estimate.quota)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-app-muted">Connection</dt>
              <dd className="font-medium">{online ? 'Online' : 'Offline — everything still works'}</dd>
            </div>
          </dl>
          {storageOk === false && (
            <p className="mt-3 rounded-lg bg-app-warning-light px-3 py-2 text-sm text-app-warning">
              Browser storage appears to be unavailable. Private browsing modes or blocked site data can prevent
              saving. Allow site data for this page, then refresh.
            </p>
          )}
          <p className="mt-3 text-xs text-app-muted">
            This app has no server. Clearing your browser data, using a different browser, or switching devices
            means your records are not there — which is why backups matter.
          </p>

          <div className="mt-4 border-t border-app-border pt-4">
            <Button variant="danger" onClick={() => setEraseOpen(true)}>
              Erase all data on this device
            </Button>
          </div>
        </Card>

        {/* Help */}
        <Card>
          <h2>Help &amp; privacy</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <h3 className="text-sm font-semibold">Is my data private?</h3>
              <p className="text-app-muted">
                Yes — it never leaves this device unless you export it. There is no account, no analytics and no
                server.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Does it work offline?</h3>
              <p className="text-app-muted">
                Yes. After the first visit the app is stored on your device and runs without a connection. Offline
                mode is shown with an “Offline” badge in the header.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">What should I record?</h3>
              <p className="text-app-muted">
                Dates, times, durations, categories and non-identifying titles. Please avoid client names,
                diagnoses and confidential details — this tracker is not a medical record system.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Reaching a target means I am compliant?</h3>
              <p className="text-app-muted">
                No. The app records your progress against the targets <em>you</em> configured. Only your licensing
                board or program can confirm requirements.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link to="/quality" className="font-medium text-app-secondary underline">
                Record Quality Check
              </Link>
              <Link to="/reports" className="font-medium text-app-secondary underline">
                Report Studio
              </Link>
              <Link to="/requirements" className="font-medium text-app-secondary underline">
                Manage targets
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Restore preview */}
      <Modal
        open={pendingRestore !== null}
        title="Restore preview"
        onClose={() => {
          if (!restoring) setPendingRestore(null);
        }}
      >
        {pendingRestore && (
          <>
            <p className="text-sm text-app-muted">
              Backup created {formatTimestamp(pendingRestore.backup.exportedAt)}. Nothing has been changed yet.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <li className="rounded-lg bg-gray-50 px-3 py-2">Activities: <strong>{pendingRestore.preview.counts.activities}</strong></li>
              <li className="rounded-lg bg-gray-50 px-3 py-2">CEU records: <strong>{pendingRestore.preview.counts.ceus}</strong></li>
              <li className="rounded-lg bg-gray-50 px-3 py-2">Targets: <strong>{pendingRestore.preview.counts.requirements}</strong></li>
              <li className="rounded-lg bg-gray-50 px-3 py-2">Categories: <strong>{pendingRestore.preview.counts.categories}</strong></li>
              <li className="rounded-lg bg-gray-50 px-3 py-2">Renewal periods: <strong>{pendingRestore.preview.counts.renewalPeriods}</strong></li>
              <li className="rounded-lg bg-gray-50 px-3 py-2">
                Matching existing records: <strong>{pendingRestore.preview.overlappingIds}</strong>
              </li>
            </ul>

            <fieldset className="mt-4">
              <legend className="label">How should we restore?</legend>
              <div className="space-y-2 text-sm">
                <label className="flex items-start gap-2 rounded-lg border border-app-border p-3">
                  <input
                    type="radio"
                    name="restore-mode"
                    className="mt-0.5 accent-app-primary"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                  />
                  <span>
                    <strong>Replace everything</strong>
                    <br />
                    <span className="text-app-muted">
                      Deletes what is on this device, then imports the backup exactly as saved.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-app-border p-3">
                  <input
                    type="radio"
                    name="restore-mode"
                    className="mt-0.5 accent-app-primary"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                  />
                  <span>
                    <strong>Merge with existing data</strong>
                    <br />
                    <span className="text-app-muted">
                      Keeps your current records and adds the backup. Records with the same ID are updated from the
                      backup.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingRestore(null)} disabled={restoring}>
                Cancel
              </Button>
              <Button onClick={() => void performRestore()} loading={restoring}>
                Restore now
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={eraseOpen}
        title="Erase everything?"
        message="Every activity, CEU record and target stored in this browser will be permanently deleted. This cannot be undone — download a backup first if you might need these records."
        confirmLabel="Erase all data"
        busy={erasing}
        onConfirm={() => void handleErase()}
        onCancel={() => setEraseOpen(false)}
      />
    </div>
  );
}
