import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { useCeus, useRenewalPeriods } from '@/hooks/useData';
import { renewalProgress } from '@/domain/ceu';
import { formatDisplayDate, todayIso } from '@/domain/date';
import { CeuForm } from '@/components/ceu/CeuForm';

/** CEU Tracker list with renewal-period progress and quick entry. */
export function CeuListPage() {
  const ceus = useCeus();
  const periods = useRenewalPeriods();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [adding, setAdding] = useState(false);

  const q = searchParams.get('q') ?? '';
  const periodId = searchParams.get('period') ?? '';
  const category = searchParams.get('category') ?? '';

  const categories = useMemo(() => [...new Set(ceus.map((c) => c.category).filter(Boolean))].sort(), [ceus]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ceus
      .filter((c) => {
        if (periodId && c.renewalPeriodId !== periodId) return false;
        if (category && c.category !== category) return false;
        if (needle && !`${c.title} ${c.provider} ${c.category}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => b.completionDate.localeCompare(a.completionDate));
  }, [ceus, q, periodId, category]);

  const totalCredits = filtered.reduce((sum, c) => sum + c.credits, 0);
  const today = todayIso();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="CEU Tracker"
        description="Continuing education records, tracked separately from clinical hours."
        actions={
          <Link to="/ceus/new" className="btn-primary">
            Add CEU record
          </Link>
        }
      />

      {/* Renewal period progress */}
      {periods.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {periods.slice(0, 4).map((period) => {
            const progress = renewalProgress(period, ceus, today);
            return (
              <div key={period.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold">{period.label}</h3>
                  <Badge
                    tone={
                      progress.status === 'ended'
                        ? 'neutral'
                        : progress.targetReached
                          ? 'success'
                          : progress.status === 'active'
                            ? 'warning'
                            : 'info'
                    }
                  >
                    {progress.status === 'ended'
                      ? 'Ended'
                      : progress.status === 'active'
                        ? `${progress.daysRemaining} days left`
                        : 'Upcoming'}
                  </Badge>
                </div>
                <p className="mb-2 text-sm text-app-muted">
                  <strong className="text-app-text">{progress.completedCredits}</strong> of {progress.targetCredits}{' '}
                  credits
                  {progress.targetReached && ' · Target reached'}
                </p>
                <ProgressBar percent={progress.percent} label={`${period.label} progress`} />
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mb-4">
          <CeuForm
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
            }}
          />
        </div>
      )}

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ceu-filter-q" className="label">
            Search
          </label>
          <input
            id="ceu-filter-q"
            type="search"
            className="input"
            placeholder="Title or provider…"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ceu-filter-period" className="label">
            Renewal period
          </label>
          <select
            id="ceu-filter-period"
            className="input"
            value={periodId}
            onChange={(e) => setParam('period', e.target.value)}
          >
            <option value="">All periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ceu-filter-category" className="label">
            Category
          </label>
          <select
            id="ceu-filter-category"
            className="input"
            value={category}
            onChange={(e) => setParam('category', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3 flex items-center justify-between">
          <p className="text-sm text-app-muted">
            {filtered.length} record{filtered.length === 1 ? '' : 's'} ·{' '}
            <strong className="text-app-text">{totalCredits} credits</strong>
          </p>
          <div className="flex gap-2">
            {adding && (
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Close form
              </Button>
            )}
            {!adding && (
              <Button variant="secondary" onClick={() => setAdding(true)}>
                Quick add here
              </Button>
            )}
          </div>
        </div>
      </div>

      {ceus.length === 0 ? (
        <EmptyState
          title="No CEU records yet"
          description="Add a course, workshop or training to start tracking your continuing education credits."
          actionLabel="Add CEU record"
          actionTo="/ceus/new"
        />
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center">
          <h3>No CEU records match these filters</h3>
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
          {filtered.map((ceu) => (
            <li key={ceu.id}>
              <Link
                to={`/ceus/${ceu.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-app-primary-light/50"
              >
                <div className="w-20 shrink-0 text-sm font-medium text-app-muted">
                  {formatDisplayDate(ceu.completionDate)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ceu.title}</p>
                  <p className="truncate text-xs text-app-muted">
                    {ceu.provider}
                    {ceu.certificateRef ? ` · Certificate ${ceu.certificateRef}` : ''}
                  </p>
                </div>
                <Badge tone="info">{ceu.category}</Badge>
                <div className="w-16 shrink-0 text-right text-sm font-semibold">{ceu.credits} cr</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
