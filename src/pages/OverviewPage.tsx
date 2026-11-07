import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, StatTile } from '@/components/ui/Card';
import { Badge, ProgressBar } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { SampleStartCard } from '@/components/sample/SampleWorkspace';
import {
  useActivities,
  useCategories,
  useCeus,
  useQualityIssues,
  useRenewalPeriods,
  useRequirements,
  useSampleState,
  useSettings,
} from '@/hooks/useData';
import { summarizeActivities } from '@/domain/summary';
import { allRequirementProgress } from '@/domain/progress';
import { renewalProgress } from '@/domain/ceu';
import { summarizeIssues } from '@/domain/quality';
import { formatDuration, formatHoursDecimal, MINUTES_PER_HOUR } from '@/domain/duration';
import { addDaysIso, compareDateStr, formatDisplayDate, startOfWeekIso, todayIso } from '@/domain/date';

/** Overview dashboard — every number comes from the shared domain layer. */
export function OverviewPage() {
  const activities = useActivities();
  const categories = useCategories();
  const requirements = useRequirements();
  const ceus = useCeus();
  const periods = useRenewalPeriods();
  const settings = useSettings();
  const sample = useSampleState();
  const issues = useQualityIssues();

  const summary = useMemo(
    () => summarizeActivities(activities, categories, settings),
    [activities, categories, settings],
  );
  const progressRows = useMemo(
    () => allRequirementProgress(requirements, activities, categories, settings),
    [requirements, activities, categories, settings],
  );
  const quality = useMemo(() => summarizeIssues(issues), [issues]);
  const today = todayIso();

  const activePeriods = useMemo(
    () =>
      periods
        .filter((p) => p.active)
        .map((p) => renewalProgress(p, ceus, today))
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [periods, ceus, today],
  );

  const upcoming = useMemo(() => {
    const items: { id: string; label: string; date: string; kind: 'ceu' | 'requirement' }[] = [];
    for (const p of activePeriods) {
      if (p.status !== 'ended') items.push({ id: p.period.id, label: `${p.period.label} ends`, date: p.period.endDate, kind: 'ceu' });
    }
    for (const r of requirements) {
      if (r.active && r.periodEnd) {
        items.push({ id: r.id, label: `${r.label} period ends`, date: r.periodEnd, kind: 'requirement' });
      }
    }
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [activePeriods, requirements]);

  const recent = useMemo(
    () => [...activities].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [activities],
  );

  // Last 8 complete weeks of tracked hours.
  const weekly = useMemo(() => {
    const thisWeek = startOfWeekIso(today);
    const buckets: { label: string; start: string; end: string; minutes: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDaysIso(thisWeek, -7 * i);
      const end = addDaysIso(start, 6);
      buckets.push({ label: formatDisplayDate(start).replace(/,.*/, ''), start, end, minutes: 0 });
    }
    for (const a of activities) {
      const bucket = buckets.find((b) => compareDateStr(a.date, b.start) >= 0 && compareDateStr(a.date, b.end) <= 0);
      if (bucket) bucket.minutes += a.durationMinutes;
    }
    return buckets.map((b) => ({ ...b, hours: Math.round((b.minutes / MINUTES_PER_HOUR) * 100) / 100 }));
  }, [activities, today]);

  const hasRecords = activities.length > 0 || ceus.length > 0;
  const clinicalTargetRow = progressRows.find((r) => r.requirement.kind === 'clinical_total');
  const clinicalTargetLabel = clinicalTargetRow?.progress.hasTarget
    ? `of ${formatHoursDecimal(clinicalTargetRow.progress.targetMinutes)} target`
    : 'no target set yet';
  const activePeriod = activePeriods.find((p) => p.status === 'active');
  const creditTotal = activePeriod?.completedCredits ?? Math.round(ceus.reduce((s, c) => s + c.credits, 0) * 100) / 100;

  return (
    <div>
      <section className="hero-panel relative mb-5 overflow-hidden rounded-2xl px-5 py-7 text-white shadow-hero sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full border border-app-gold/20" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow text-app-gold">
              {settings?.profession || 'Clinical progress workspace'}
            </p>
            <h1 className="mt-2 text-white">
              {settings?.displayName ? `Welcome back, ${settings.displayName}.` : 'Your clinical journey, at a glance.'}
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/70">
              {hasRecords
                ? 'Every hour, supervision session and CEU in one calm, private place. Here is where you stand today.'
                : 'Log one activity to get started — it takes under a minute. Or explore a realistic sample workspace and clear it whenever you like.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/activities/new?type=clinical" className="btn-gold">
                <Icon name="plus" size={16} /> Log activity
              </Link>
              <Link to="/activities/new?type=supervision" className="btn-secondary">
                Log supervision
              </Link>
              <Link to="/ceus/new" className="btn-secondary">
                Add CEU
              </Link>
            </div>
          </div>

          {clinicalTargetRow?.progress.hasTarget && (
            <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-app-gold">
                <span>Current target</span>
                <span>{clinicalTargetRow.progress.percent}%</span>
              </div>
              <p className="mt-2 font-display text-[2rem] font-semibold leading-none text-white">
                {formatHoursDecimal(clinicalTargetRow.progress.completedMinutes)}
                <span className="ml-1 text-base font-normal text-white/60">
                  / {formatHoursDecimal(clinicalTargetRow.progress.targetMinutes)} h
                </span>
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D7B36A] to-app-gold"
                  style={{ width: `${Math.min(100, Math.max(0, clinicalTargetRow.progress.percent))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/65">{clinicalTargetRow.requirement.label}</p>
            </div>
          )}
        </div>
      </section>

      {!hasRecords && !sample.active && (
        <div className="mb-5">
          <SampleStartCard />
        </div>
      )}

      {!hasRecords && sample.active && (
        <div className="mb-5 rounded-xl border border-app-gold/30 bg-app-gold-light px-4 py-3 text-sm text-app-text">
          <span className="font-semibold text-app-gold-dark">Sample workspace is loaded.</span>{' '}
          Explore the screens below, then remove the demo records from the banner above or from Settings.
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total clinical hours"
          value={formatHoursDecimal(summary.clinicalMinutes)}
          hint={clinicalTargetLabel}
          icon="clock"
          tone="primary"
          footer={`Direct ${formatHoursDecimal(summary.directMinutes)} · Indirect ${formatHoursDecimal(summary.indirectMinutes)}`}
        />
        <StatTile
          label="Supervision"
          value={formatHoursDecimal(summary.supervisionMinutes)}
          hint="hours recorded"
          icon="pulse"
          tone="secondary"
          footer={`Individual ${formatDuration(summary.individualSupervisionMinutes)} · Group ${formatDuration(summary.groupSupervisionMinutes)}`}
        />
        <StatTile
          label="CEU credits"
          value={String(creditTotal)}
          hint={activePeriod ? `of ${activePeriod.targetCredits} this cycle` : 'total recorded'}
          icon="award"
          tone="gold"
          footer={`${ceus.length} CEU record${ceus.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Record quality"
          value={quality.total === 0 ? 'All clear' : String(quality.total)}
          hint={quality.total === 0 ? 'no issues detected' : `${quality.errors} to fix · ${quality.warnings} to review`}
          icon={quality.total === 0 ? 'shield' : 'warning'}
          tone={quality.total === 0 ? 'primary' : 'gold'}
          footer={
            <Link to="/quality" className="font-semibold text-app-primary underline decoration-app-primary/30 underline-offset-4">
              Open quality check
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Clinical Journey Map */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Milestones</p>
              <h2 className="mt-1">Clinical journey map</h2>
            </div>
            <Link to="/requirements" className="link-quiet">
              Manage targets
            </Link>
          </div>

          {progressRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-app-border bg-app-bg/60 px-4 py-6 text-center">
              <p className="text-sm text-app-muted">
                No targets yet. Add one in Requirements to see your journey toward each milestone.
              </p>
              <Link to="/requirements" className="btn-secondary mt-3">
                Add your first target
              </Link>
            </div>
          ) : (
            <ul className="space-y-5">
              {progressRows.map(({ requirement, progress }) => (
                <li key={requirement.id}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{requirement.label}</span>
                      {progress.targetReached && <Badge tone="success">Target reached</Badge>}
                    </div>
                    <span className="text-sm text-app-muted">
                      {formatDuration(progress.completedMinutes)} / {formatDuration(progress.targetMinutes)}
                      {!progress.targetReached && ` · ${formatDuration(progress.remainingMinutes)} to go`}
                    </span>
                  </div>
                  <ProgressBar
                    percent={progress.percent}
                    label={`${requirement.label}: ${progress.percent}%`}
                    tone={
                      requirement.kind === 'supervision_total' ||
                      requirement.kind === 'individual_supervision' ||
                      requirement.kind === 'group_supervision'
                        ? 'secondary'
                        : 'primary'
                    }
                  />
                  <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-app-muted">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-gold-light text-app-gold-dark">
                <Icon name="calendar" size={17} />
              </span>
              <h2>Upcoming deadlines</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-app-muted">No renewal periods or dated targets configured yet.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 border-b border-app-border/70 pb-2 text-sm last:border-0 last:pb-0">
                    <span className="truncate">{item.label}</span>
                    <Link
                      to={item.kind === 'ceu' ? '/ceus' : '/requirements'}
                      className="shrink-0 font-medium text-app-secondary underline decoration-app-secondary/30 underline-offset-4"
                    >
                      {formatDisplayDate(item.date)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary-light text-app-primary">
                <Icon name="shield" size={17} />
              </span>
              <h2>Record quality</h2>
            </div>
            {issues.length === 0 ? (
              <p className="text-sm text-app-muted">Everything looks consistent. Nice work.</p>
            ) : (
              <ul className="space-y-2">
                {issues.slice(0, 3).map((issue) => (
                  <li key={issue.id} className="text-sm">
                    <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                      {issue.severity === 'error' ? 'Fix' : 'Review'}
                    </Badge>{' '}
                    <span className="text-app-muted">{issue.recordLabel}</span>
                  </li>
                ))}
                {issues.length > 3 && (
                  <li className="text-xs text-app-muted">+ {issues.length - 3} more</li>
                )}
              </ul>
            )}
            <Link to="/quality" className="link-quiet mt-3 inline-block">
              Review all
            </Link>
          </Card>
        </div>
      </div>

      {/* Weekly chart + recent */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Trend</p>
              <h2 className="mt-1">Hours over the last 8 weeks</h2>
            </div>
            <Link to="/reports" className="link-quiet">
              Open reports
            </Link>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-app-muted">Log an activity and this chart will fill in.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6A7872' }} tickLine={false} axisLine={{ stroke: '#E6DFD1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6A7872' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [`${value} h`, 'Hours']}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E6DFD1',
                      fontSize: 12,
                      boxShadow: '0 12px 28px -18px rgba(20,32,28,0.45)',
                    }}
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {weekly.map((entry, index) => (
                      <Cell key={entry.label} fill={index === weekly.length - 1 ? '#0D5B51' : '#B98A33'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2>Recent activities</h2>
            <Link to="/activities" className="link-quiet">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-app-muted">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-app-border">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link to={`/activities/${a.id}`} className="-mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-app-primary-light/40">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-app-muted">
                      {formatDisplayDate(a.date)} · {formatDuration(a.durationMinutes)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

    </div>
  );
}
