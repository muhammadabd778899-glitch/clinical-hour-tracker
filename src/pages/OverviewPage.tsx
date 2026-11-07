import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/feedback';
import { useActivities, useCeus, useQualityIssues, useRenewalPeriods, useRequirements, useSettings, useCategories } from '@/hooks/useData';
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
    : 'no target set';

  return (
    <div>
      <PageHeader
        title="Overview"
        description={
          settings?.displayName
            ? `Welcome back, ${settings.displayName}. Here is your progress at a glance.`
            : 'Your clinical progress at a glance — all data stays on this device.'
        }
        actions={
          <>
            <Link to="/activities/new?type=clinical" className="btn-primary">
              Log activity
            </Link>
            <Link to="/activities/new?type=supervision" className="btn-secondary">
              Log supervision
            </Link>
            <Link to="/ceus/new" className="btn-secondary">
              Add CEU
            </Link>
          </>
        }
      />

      {!hasRecords && (
        <Card className="mb-4 border-app-primary/30 bg-app-primary-light">
          <h3 className="text-app-primary">Let’s get you started</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-app-text">
            <li>
              Log one activity in the <Link to="/activities" className="font-medium text-app-secondary underline">Activity Log</Link> — it takes under a minute.
            </li>
            <li>
              Add a target in <Link to="/requirements" className="font-medium text-app-secondary underline">Requirements</Link> so you can see progress toward your goal.
            </li>
            <li>
              Check <Link to="/reports" className="font-medium text-app-secondary underline">Reports</Link> whenever you need an organised summary or export.
            </li>
          </ol>
        </Card>
      )}

      {/* Stat cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total clinical hours"
          value={formatHoursDecimal(summary.clinicalMinutes)}
          sub={clinicalTargetLabel}
          footer={`Direct ${formatHoursDecimal(summary.directMinutes)} · Indirect ${formatHoursDecimal(summary.indirectMinutes)}`}
        />
        <StatCard
          label="Supervision"
          value={formatHoursDecimal(summary.supervisionMinutes)}
          sub="hours recorded"
          footer={`Individual ${formatDuration(summary.individualSupervisionMinutes)} · Group ${formatDuration(summary.groupSupervisionMinutes)}`}
        />
        <StatCard
          label="CEU credits"
          value={String(
            activePeriods.find((p) => p.status === 'active')?.completedCredits ??
              Math.round(ceus.reduce((s, c) => s + c.credits, 0) * 100) / 100,
          )}
          sub={
            activePeriods.find((p) => p.status === 'active')
              ? `of ${activePeriods.find((p) => p.status === 'active')!.targetCredits} in current period`
              : 'total recorded'
          }
          footer={`${ceus.length} CEU record${ceus.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Record quality"
          value={quality.total === 0 ? 'All clear' : String(quality.total)}
          sub={quality.total === 0 ? 'no issues detected' : `${quality.errors} to fix · ${quality.warnings} to review`}
          footer={<Link to="/quality" className="text-app-secondary underline">Open quality check</Link>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Clinical Journey Map */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2>Clinical Journey Map</h2>
            <Link to="/requirements" className="text-sm text-app-secondary underline">
              Manage targets
            </Link>
          </div>

          {progressRows.length === 0 ? (
            <p className="text-sm text-app-muted">
              No targets yet. Add one in Requirements to see your journey toward each milestone.
            </p>
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
                  <div className="relative">
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
                  </div>
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
          {/* Deadlines */}
          <Card>
            <h2 className="mb-2">Upcoming deadlines</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-app-muted">No renewal periods or dated targets configured yet.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{item.label}</span>
                    <Link
                      to={item.kind === 'ceu' ? '/ceus' : '/requirements'}
                      className="shrink-0 font-medium text-app-secondary underline"
                    >
                      {formatDisplayDate(item.date)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quality preview */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2>Record quality</h2>
              <Link to="/quality" className="text-sm text-app-secondary underline">
                Review all
              </Link>
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
          </Card>
        </div>
      </div>

      {/* Weekly chart + recent */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3">Hours over the last 8 weeks</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-app-muted">Log an activity and this chart will fill in.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#718096' }} tickLine={false} axisLine={{ stroke: '#E6EAF0' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#718096' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [`${value} h`, 'Hours']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E6EAF0', fontSize: 12 }}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {weekly.map((entry, index) => (
                      <Cell key={entry.label} fill={index === weekly.length - 1 ? '#147D78' : '#4779A8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2>Recent activities</h2>
            <Link to="/activities" className="text-sm text-app-secondary underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-app-muted">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-app-border">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link to={`/activities/${a.id}`} className="block py-2 hover:bg-app-primary-light/40">
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

      {!hasRecords && (
        <div className="mt-4">
          <EmptyState
            title="Your workspace is empty"
            description="Nothing is stored in a spreadsheet or in the cloud — your records live in this browser on this device. Start by logging one activity."
            actionLabel="Log your first activity"
            actionTo="/activities/new?type=clinical"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  footer,
}: {
  label: string;
  value: string;
  sub: string;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-sm text-app-muted">{sub}</p>
      {footer && <div className="mt-2 border-t border-app-border pt-2 text-xs text-app-muted">{footer}</div>}
    </Card>
  );
}
