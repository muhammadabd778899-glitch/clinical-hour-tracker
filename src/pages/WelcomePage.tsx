import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { updateSettings } from '@/services/settings';
import { saveRequirement } from '@/services/catalog';
import { hoursToMinutes } from '@/domain/duration';
import { ServiceError } from '@/services/errors';

/**
 * First-run onboarding. Everything except the storage acknowledgement is
 * optional — users can start logging immediately.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [displayName, setDisplayName] = useState('');
  const [profession, setProfession] = useState('');
  const [targetHours, setTargetHours] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const complete = async (includeTarget: boolean) => {
    if (saving) return;
    if (!acknowledged) {
      setError('Please confirm you understand where your data is stored.');
      return;
    }
    if (includeTarget && targetHours && (!Number.isFinite(Number(targetHours)) || Number(targetHours) <= 0)) {
      setError('Enter a target greater than zero, or leave it empty to skip.');
      return;
    }

    setSaving(true);
    try {
      await updateSettings({
        onboarded: true,
        displayName: displayName.trim(),
        profession: profession.trim(),
      });
      if (includeTarget && targetHours) {
        await saveRequirement({
          id: '',
          label: 'Total clinical hours',
          kind: 'clinical_total',
          categoryId: null,
          targetMinutes: hoursToMinutes(Number(targetHours)),
          periodStart: null,
          periodEnd: null,
          active: true,
        });
      }
      toast.success('Your workspace is ready.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'We could not finish setup. Please try again.');
      setSaving(false);
    }
  };

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    await complete(true);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Welcome to All in One Clinical Tracker"
        description="A simple, private clinical progress workspace for hours, supervision, CEUs and career milestones — completely offline."
      />

      <form onSubmit={finish} noValidate className="space-y-4">
        <Card>
          <h3>1. A little about you (optional)</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="What should we call you?" htmlFor="onb-name" hint="Shown only on this device.">
              <Input
                id="onb-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={80}
              />
            </Field>
            <Field label="Your role (optional)" htmlFor="onb-profession" hint="e.g. Counseling intern">
              <Select id="onb-profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
                <option value="">Choose…</option>
                <option>Counseling / psychology student</option>
                <option>Social work student or intern</option>
                <option>Clinical trainee</option>
                <option>Licensure candidate</option>
                <option>Licensed professional</option>
                <option>Other</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <h3>2. Your first target (optional)</h3>
          <p className="mt-1 text-sm text-app-muted">
            You can add more targets, supervision goals and CEU periods later. Skip this if you want to look around
            first.
          </p>
          <div className="mt-3 max-w-56">
            <Field label="Clinical hours goal" htmlFor="onb-target" hint="Leave empty to skip.">
              <Input
                id="onb-target"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="e.g. 600"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h3>3. Good to know</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-muted">
            <li>Your records are stored in this browser on this device — there is no account and no cloud.</li>
            <li>The app works without an internet connection after the first load.</li>
            <li>Because data lives only here, back up your data regularly from Settings &amp; Help.</li>
            <li>Please do not enter client names, diagnoses or confidential health details.</li>
            <li>This is a progress tracker — not a medical record system, and not a licensing authority.</li>
          </ul>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-app-primary"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I understand my data is saved only on this device, and I will keep a backup if I care about these
              records.
            </span>
          </label>
        </Card>

        {error && (
          <p className="rounded-lg bg-app-danger-light px-3 py-2 text-sm font-medium text-app-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>
            Start tracking
          </Button>
          <Button variant="secondary" onClick={() => void complete(false)} disabled={saving}>
            Skip to the app
          </Button>
        </div>
      </form>
    </div>
  );
}
