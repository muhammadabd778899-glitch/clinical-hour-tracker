import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useActivities, useCategories } from '@/hooks/useData';
import { categoriesForType } from '@/components/activity/ActivityForm';
import { createActivity } from '@/services/activity';
import { activityFormSchema, type ActivityFormValues } from '@/validation/schemas';
import { formatDuration } from '@/domain/duration';
import { formatDisplayDate, todayIso } from '@/domain/date';
import type { Activity, ActivityType, Category } from '@/domain/types';
import { ServiceError } from '@/services/errors';
type SortKey = 'date_desc' | 'date_asc' | 'duration_desc' | 'title_asc';

const TYPE_LABEL: Record<ActivityType, string> = {
  clinical: 'Clinical',
  supervision: 'Supervision',
  other: 'Other',
};

function applyFilters(
  activities: Activity[],
  filters: { q: string; type: string; category: string; from: string; to: string; sort: SortKey },
  categories: Category[],
): Activity[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const q = filters.q.trim().toLowerCase();

  const filtered = activities.filter((a) => {
    if (filters.type && a.type !== filters.type) return false;
    if (filters.category && a.categoryId !== filters.category) return false;
    if (filters.from && a.date < filters.from) return false;
    if (filters.to && a.date > filters.to) return false;
    if (q) {
      const haystack = [
        a.title,
        a.location ?? '',
        a.notes ?? '',
        categoryById.get(a.categoryId ?? '')?.label ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'date_asc':
      sorted.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      break;
    case 'duration_desc':
      sorted.sort((a, b) => b.durationMinutes - a.durationMinutes);
      break;
    case 'title_asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      sorted.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  return sorted;
}

/** The Activity Log: fast entry, full entry, search, filters and sorting. */
export function ActivityListPage() {
  const location = useLocation();
  const activities = useActivities();
  const categories = useCategories();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickOpen, setQuickOpen] = useState(false);

  const q = searchParams.get('q') ?? '';
  const type = searchParams.get('type') ?? '';
  const category = searchParams.get('category') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sort = (searchParams.get('sort') as SortKey) ?? 'date_desc';
  const filters = { q, type, category, from, to, sort };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(
    () => applyFilters(activities, { q, type, category, from, to, sort }, categories),
    [activities, categories, q, type, category, from, to, sort],
  );

  const totalMinutes = filtered.reduce((sum, a) => sum + a.durationMinutes, 0);
  const hasAny = activities.length > 0;
  const hasFilters = Boolean(filters.q || filters.type || filters.category || filters.from || filters.to);

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Every clinical, supervision and professional activity you have recorded."
        actions={
          <>
            <Button variant="secondary" onClick={() => setQuickOpen((v) => !v)} aria-expanded={quickOpen}>
              {quickOpen ? 'Hide quick add' : 'Quick add'}
            </Button>
            <Link to="/activities/new?type=clinical" className="btn-primary">
              Full entry form
            </Link>
          </>
        }
      />

      {quickOpen && (
        <QuickAddCard
          categories={categories}
          onCancel={() => setQuickOpen(false)}
          onSaved={() => toast.success('Activity saved.')}
        />
      )}

      {/* Filters */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="filter-q" className="label">
            Search
          </label>
          <Input
            id="filter-q"
            type="search"
            placeholder="Title, location, notes…"
            value={filters.q}
            onChange={(e) => setParam('q', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="filter-type" className="label">
            Type
          </label>
          <Select id="filter-type" value={filters.type} onChange={(e) => setParam('type', e.target.value)}>
            <option value="">All types</option>
            <option value="clinical">Clinical</option>
            <option value="supervision">Supervision</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <label htmlFor="filter-category" className="label">
            Category
          </label>
          <Select
            id="filter-category"
            value={filters.category}
            onChange={(e) => setParam('category', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="filter-from" className="label">
            From
          </label>
          <Input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(e) => setParam('from', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="filter-to" className="label">
            To
          </label>
          <Input id="filter-to" type="date" value={filters.to} onChange={(e) => setParam('to', e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4 lg:flex lg:items-end">
          <p data-testid="result-count" className="text-sm text-app-muted">
            Showing <strong className="text-app-text">{filtered.length}</strong> of {activities.length} activities ·{' '}
            <strong className="text-app-text">{formatDuration(totalMinutes)}</strong> total
          </p>
        </div>
        <div className="lg:col-span-2 lg:flex lg:items-end lg:justify-end">
          <label htmlFor="filter-sort" className="label lg:sr-only">
            Sort
          </label>
          <Select
            id="filter-sort"
            className="lg:w-auto"
            value={filters.sort}
            onChange={(e) => setParam('sort', e.target.value)}
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="duration_desc">Longest duration</option>
            <option value="title_asc">Title A–Z</option>
          </Select>
        </div>
        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-6">
            <button type="button" className="text-sm font-medium text-app-secondary underline" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {!hasAny ? (
        <EmptyState
          title="No activities yet"
          description="Log your first clinical activity or supervision session to start tracking your progress."
          actionLabel="Log an activity"
          actionTo="/activities/new?type=clinical"
        />
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center">
          <h3>No activities match these filters</h3>
          <p className="mt-1 text-sm text-app-muted">Try widening the date range or clearing the filters.</p>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="card divide-y divide-app-border overflow-hidden">
          {filtered.map((activity) => {
            const category = categories.find((c) => c.id === activity.categoryId);
            return (
              <li key={activity.id}>
                <Link
                  to={`/activities/${activity.id}`}
                  state={{ from: `${location.pathname}${location.search}` }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-app-primary-light/50"
                >
                  <div className="w-20 shrink-0 text-sm font-medium text-app-muted">
                    {formatDisplayDate(activity.date)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{activity.title}</p>
                    <p className="truncate text-xs text-app-muted">
                      {category?.label ?? 'Uncategorised'}
                      {activity.location ? ` · ${activity.location}` : ''}
                    </p>
                  </div>
                  <Badge
                    tone={activity.type === 'supervision' ? 'info' : activity.type === 'clinical' ? 'success' : 'neutral'}
                  >
                    {TYPE_LABEL[activity.type]}
                  </Badge>
                  <div className="w-16 shrink-0 text-right text-sm font-semibold">
                    {formatDuration(activity.durationMinutes)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Compact one-step entry used from the Activity Log header. */
function QuickAddCard({
  categories,
  onCancel,
  onSaved,
}: {
  categories: Category[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<ActivityType>('clinical');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = categoriesForType(categories, type);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!categoryId) {
      setError('Choose a category for these hours.');
      return;
    }

    const values: ActivityFormValues = {
      type,
      categoryId: categoryId || null,
      title: title.trim(),
      date,
      startTime: null,
      endTime: null,
      durationMinutes: Number(duration),
      location: null,
      notes: null,
    };

    const parsed = activityFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      await createActivity(parsed.data);
      onSaved();
      setTitle('');
      setDuration('');
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'We could not save this activity.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card mb-4 p-4" aria-label="Quick add activity">
      <div className="mb-3 flex items-center justify-between">
        <h3>Quick add</h3>
        <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onCancel}>
          Hide
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Type" htmlFor="quick-type" required>
          <Select
            id="quick-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ActivityType);
              setCategoryId('');
            }}
          >
            <option value="clinical">Clinical</option>
            <option value="supervision">Supervision</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Category" htmlFor="quick-category" required>
          <Select id="quick-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="quick-date" required>
          <Input id="quick-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Minutes" htmlFor="quick-duration" required>
          <Input
            id="quick-duration"
            type="number"
            min={1}
            max={1440}
            inputMode="numeric"
            placeholder="e.g. 60"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Field>
        <Field label="Title" htmlFor="quick-title" required>
          <Input
            id="quick-title"
            placeholder="e.g. Intake session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </div>
      {error && (
        <p className="mt-2 text-sm font-medium text-app-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="submit" loading={saving}>
          Save activity
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
