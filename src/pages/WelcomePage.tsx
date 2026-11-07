import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { updateSettings } from '@/services/settings';
import { saveRequirement } from '@/services/catalog';
import { loadSampleWorkspace } from '@/services/sample';
import { hoursToMinutes } from '@/domain/duration';
import { ServiceError } from '@/services/errors';

/**
 * First-run onboarding. Everything except the storage acknowledgement is
 * optional — users can start logging immediately, or explore a sample profile.
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
  const [loadingSample, setLoadingSample] = useState(false);

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

  const startWithSample = async () => {
    if (loadingSample || saving) return;
    setError(null);
    setLoadingSample(true);
    try {
      await loadSampleWorkspace();
      toast.success('Sample workspace loaded — look around, then clear it whenever you like.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'We could not load the sample workspace.');
      setLoadingSample(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <section className="hero-panel relative mb-5 overflow-hidden rounded-2xl px-5 py-8 text-white shadow-hero sm:px-8 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border border-white/10" />
        <p className="eyebrow text-app-gold">Welcome</p>
        <h1 className="mt-2 max-w-xl text-white">All in One Clinical Tracker</h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/70">
          A calm, private workspace for clinical hours, supervision, CEUs and career milestones — completely
          offline, with no account and no cloud.
        </p>
        <div className="mt-5 grid gap-2 text-xs text-white/80 sm:grid-cols-3">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Icon name="clock" size={15} className="text-app-gold" /> Hours &amp; supervision
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Icon name="target" size={15} className="text-app-gold" /> Milestone targets
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Icon name="award" size={15} className="text-app-gold" /> CEU renewal tracking
          </span>
        </div>
      </section>

      <form onSubmit={finish} noValidate className="space-y-4">
        <Card>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primary-light text-app-primary">
              <Icon name="user" size={16} />
            </span>
            <h3>1. A little about you (optional)</h3>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-gold-light text-app-gold-dark">
              <Icon name="target" size={16} />
            </span>
            <h3>2. Your first target (optional)</h3>
          </div>
          <p className="mt-2 text-sm text-app-muted">
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
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-secondary-light text-app-secondary">
              <Icon name="shield" size={16} />
            </span>
            <h3>3. Good to know</h3>
          </div>
          <ul className="mt-3 grid gap-2 text-sm text-app-muted sm:grid-cols-2">
            <li className="rounded-lg bg-app-bg px-3 py-2">Records stay in this browser on this device — no account, no cloud.</li>
            <li className="rounded-lg bg-app-bg px-3 py-2">Works without internet after the first load.</li>
            <li className="rounded-lg bg-app-bg px-3 py-2">Back up regularly from Settings &amp; Help.</li>
            <li className="rounded-lg bg-app-bg px-3 py-2">Never enter client names, diagnoses or confidential details.</li>
          </ul>
          <p className="mt-3 text-xs text-app-muted">
            This is a progress tracker — not a medical record system, and not a licensing authority.
          </p>

          <label className="mt-4 flex items-start gap-2 rounded-xl border border-app-border bg-app-bg/50 p-3 text-sm">
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
          <p className="rounded-xl bg-app-danger-light px-3 py-2 text-sm font-medium text-app-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={saving}>
            Start tracking
          </Button>
          <Button variant="secondary" onClick={() => void complete(false)} disabled={saving || loadingSample}>
            Skip to the app
          </Button>
          <Button
            variant="gold"
            onClick={() => void startWithSample()}
            loading={loadingSample}
            disabled={saving}
            className="sm:ml-auto"
          >
            <Icon name="spark" size={16} /> Explore with sample data
          </Button>
        </div>
      </form>
    </div>
  );
}
