import { useMemo, useState, type FormEvent } from 'react';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useActivities, useCategories, useRequirements, useSettings } from '@/hooks/useData';
import { deleteRequirement, saveRequirement, saveCategory, deactivateCategory, reactivateCategory } from '@/services/catalog';
import { requirementProgress } from '@/domain/progress';
import { formatDuration, hoursToMinutes, minutesToHours } from '@/domain/duration';
import { formatDisplayDate } from '@/domain/date';
import { ServiceError } from '@/services/errors';
import type { Requirement, RequirementKind } from '@/domain/types';

const KIND_OPTIONS: { value: RequirementKind; label: string; explanation: string }[] = [
  { value: 'clinical_total', label: 'Total clinical hours', explanation: 'Direct + indirect hours (plus supervision only if you enable that in Settings).' },
  { value: 'direct', label: 'Direct hours', explanation: 'Hours from categories classified as direct client work.' },
  { value: 'indirect', label: 'Indirect hours', explanation: 'Hours from categories classified as indirect work.' },
  { value: 'supervision_total', label: 'Total supervision', explanation: 'Individual + group supervision hours.' },
  { value: 'individual_supervision', label: 'Individual supervision', explanation: 'Hours from individual supervision categories.' },
  { value: 'group_supervision', label: 'Group supervision', explanation: 'Hours from group supervision categories.' },
  { value: 'custom_category', label: 'A specific category', explanation: 'Progress counted from one category you choose.' },
];

/** Requirements & progress — user-configured targets, no hard-coded rules. */
export function RequirementsPage() {
  const requirements = useRequirements();
  const activities = useActivities();
  const categories = useCategories();
  const settings = useSettings();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Requirement | null>(null);
  const [deleting, setDeleting] = useState<Requirement | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      requirements
        .filter((r) => r.active)
        .map((requirement) => ({
          requirement,
          progress: requirementProgress(requirement, activities, categories, settings),
        }))
        .sort((a, b) => b.progress.percent - a.progress.percent),
    [requirements, activities, categories, settings],
  );

  const handleDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteRequirement(deleting.id);
      toast.success('Target removed.');
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not remove this target.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Requirements"
        eyebrow="Milestones"
        description="Set your own targets — hours, supervision and timelines — exactly as your program or board requires of you."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm && !editing ? 'Close form' : 'Add a target'}
          </Button>
        }
      />

      <Card className="mb-4 border-app-secondary/30 bg-app-secondary-light">
        <h3 className="text-app-secondary">How progress is calculated</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-text">
          <li>Total clinical hours = direct hours + indirect hours{settings?.includeSupervisionInClinicalTotal ? ', plus supervision (enabled in Settings)' : ' (supervision is counted separately)' }.</li>
          <li>Supervision = individual supervision + group supervision.</li>
          <li>Custom category targets count only that category's active activities.</li>
          <li>Only activities inside a target's date period count toward it.</li>
          <li>CEU credits are never included in any hour total.</li>
        </ul>
        <p className="mt-2 text-xs text-app-muted">
          Reaching a target shows “Target reached” — it records your progress. It does not certify eligibility or
          compliance with any licensing rule.
        </p>
      </Card>

      {showForm && (
        <div className="mb-4">
          <RequirementForm
            requirement={editing}
            categories={categories}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              toast.success(editing ? 'Target updated.' : 'Target added.');
            }}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No targets yet"
          description="Add a target to see completed hours, remaining hours and progress in one place. You can set as many or as few as you need."
          actionLabel="Add a target"
          onAction={() => {
            setEditing(null);
            setShowForm(true);
          }}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map(({ requirement, progress }) => (
            <li key={requirement.id} className="card p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3>{requirement.label}</h3>
                    {progress.targetReached && <Badge tone="success">Target reached</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-app-muted">
                    {KIND_OPTIONS.find((k) => k.value === requirement.kind)?.explanation}
                    {requirement.periodStart || requirement.periodEnd
                      ? ` · Period: ${formatDisplayDate(requirement.periodStart)} – ${formatDisplayDate(requirement.periodEnd)}`
                      : ' · No date period (all time)'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(requirement);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleting(requirement)}>
                    Remove
                  </Button>
                </div>
              </div>

              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span>
                  <strong>{formatDuration(progress.completedMinutes)}</strong> of{' '}
                  {formatDuration(progress.targetMinutes)}
                </span>
                <span className="text-app-muted">
                  {progress.percent}% · {formatDuration(progress.remainingMinutes)} remaining
                </span>
              </div>
              <ProgressBar
                percent={progress.percent}
                label={`${requirement.label}: ${progress.percent}% complete`}
              />
              <p className="mt-1.5 text-xs text-app-muted">
                Progress recorded from {requirement.kind === 'clinical_total' ? 'clinical activities' : 'matching activities'}.
              </p>
            </li>
          ))}
        </ul>
      )}

      <CategoriesCard categories={categories} activities={activities} />

      <ConfirmDialog
        open={deleting !== null}
        title="Remove this target?"
        message={`"${deleting?.label ?? ''}" will be removed. Your recorded activities are not affected.`}
        busy={busy}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

interface RequirementFormProps {
  requirement: Requirement | null;
  categories: ReturnType<typeof useCategories>;
  onCancel: () => void;
  onSaved: () => void;
}

function RequirementForm({ requirement, categories, onCancel, onSaved }: RequirementFormProps) {
  const [label, setLabel] = useState(requirement?.label ?? '');
  const [kind, setKind] = useState<RequirementKind>(requirement?.kind ?? 'clinical_total');
  const [categoryId, setCategoryId] = useState(requirement?.categoryId ?? '');
  const [hours, setHours] = useState(requirement ? String(minutesToHours(requirement.targetMinutes)) : '');
  const [periodStart, setPeriodStart] = useState(requirement?.periodStart ?? '');
  const [periodEnd, setPeriodEnd] = useState(requirement?.periodEnd ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const numericHours = Number(hours);
    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setError('Enter a target greater than zero hours.');
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setError('The period end must be on or after the period start.');
      return;
    }
    if (kind === 'custom_category' && !categoryId) {
      setError('Choose which category this target applies to.');
      return;
    }

    setSaving(true);
    try {
      await saveRequirement({
        id: requirement?.id ?? '',
        label: label.trim(),
        kind,
        categoryId: kind === 'custom_category' ? categoryId : null,
        targetMinutes: hoursToMinutes(numericHours),
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        active: requirement?.active ?? true,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'We could not save this target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card p-5" aria-label="Target form">
      <h3 className="mb-3">{requirement ? 'Edit target' : 'Add a target'}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Target name" htmlFor="req-label" required error={undefined}>
            <Input
              id="req-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 600 clinical hours by August"
            />
          </Field>
        </div>
        <Field label="What does this measure?" htmlFor="req-kind" required>
          <Select id="req-kind" value={kind} onChange={(e) => setKind(e.target.value as RequirementKind)}>
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target (hours)" htmlFor="req-hours" required hint="Decimal hours are fine, e.g. 450 or 62.5.">
          <Input
            id="req-hours"
            type="number"
            min={0.5}
            step={0.5}
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        {kind === 'custom_category' && (
          <Field label="Category" htmlFor="req-category" required>
            <Select id="req-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose a category…</option>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field label="Period start (optional)" htmlFor="req-start">
          <Input id="req-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </Field>
        <Field label="Period end (optional)" htmlFor="req-end">
          <Input id="req-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
      </div>
      {error && (
        <p className="mt-3 text-sm font-medium text-app-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2 border-t border-app-border pt-4">
        <Button type="submit" loading={saving}>
          Save target
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const CATEGORY_KIND_LABEL: Record<string, string> = {
  direct: 'Direct',
  indirect: 'Indirect',
  individual_supervision: 'Individual supervision',
  group_supervision: 'Group supervision',
  other: 'Other',
};

function CategoriesCard({
  categories,
  activities,
}: {
  categories: ReturnType<typeof useCategories>;
  activities: ReturnType<typeof useActivities>;
}) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('direct');
  const [saving, setSaving] = useState(false);
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activities) {
      if (!a.categoryId) continue;
      map.set(a.categoryId, (map.get(a.categoryId) ?? 0) + a.durationMinutes);
    }
    return map;
  }, [activities]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!label.trim()) {
      toast.error('Give the category a name.');
      return;
    }
    setSaving(true);
    try {
      await saveCategory({ label: label.trim(), kind });
      setLabel('');
      toast.success('Category added.');
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not save this category.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (category: (typeof categories)[number]) => {
    try {
      if (category.active) {
        await deactivateCategory(category.id);
        toast.info(`"${category.label}" turned off. Existing records keep their category.`);
      } else {
        await reactivateCategory(category.id);
        toast.success(`"${category.label}" turned on.`);
      }
    } catch {
      toast.error('We could not update this category.');
    }
  };

  return (
    <Card className="mt-6">
      <h3>Categories</h3>
      <p className="mt-1 text-sm text-app-muted">
        Categories decide which bucket hours land in. Turning one off hides it from forms but never changes
        records you already saved.
      </p>

      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2" aria-label="Add category">
        <div className="min-w-40 flex-1">
          <Field label="New category name" htmlFor="cat-label" required>
            <Input id="cat-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Group intake" />
          </Field>
        </div>
        <div className="min-w-44">
          <Field label="Bucket" htmlFor="cat-kind" required>
            <Select id="cat-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="direct">Direct</option>
              <option value="indirect">Indirect</option>
              <option value="individual_supervision">Individual supervision</option>
              <option value="group_supervision">Group supervision</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Button type="submit" loading={saving}>
          Add category
        </Button>
      </form>

      <ul className="mt-4 divide-y divide-app-border">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm font-medium">
                {category.label}{' '}
                {!category.active && <Badge tone="warning">Turned off</Badge>}
              </p>
              <p className="text-xs text-app-muted">
                {CATEGORY_KIND_LABEL[category.kind] ?? category.kind.replace(/_/g, ' ')} ·{' '}
                {formatDuration(usage.get(category.id) ?? 0)} recorded
              </p>
            </div>
            <Button variant="secondary" onClick={() => void toggle(category)}>
              {category.active ? 'Turn off' : 'Turn on'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
