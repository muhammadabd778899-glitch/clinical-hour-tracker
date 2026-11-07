import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { useActivities, useRenewalPeriods, useRequirements } from '@/hooks/useData';
import {
  addDaysIso,
  compareDateStr,
  endOfMonthIso,
  formatDisplayDate,
  formatShortDate,
  isWithinRange,
  startOfMonthIso,
  startOfWeekIso,
  todayIso,
} from '@/domain/date';
import { formatDuration } from '@/domain/duration';
import type { Activity, ActivityType } from '@/domain/types';

type ViewMode = 'month' | 'week' | 'list';

const TYPE_STYLE: Record<ActivityType, string> = {
  clinical: 'bg-app-primary-light text-app-primary',
  supervision: 'bg-app-secondary-light text-app-secondary',
  other: 'bg-gray-100 text-app-muted',
};

const TYPE_LABEL: Record<ActivityType, string> = {
  clinical: 'Clinical',
  supervision: 'Supervision',
  other: 'Other',
};

interface Deadline {
  date: string;
  label: string;
  to: string;
}

/** Unified clinical activity calendar with month, week and list views. */
export function CalendarPage() {
  const activities = useActivities();
  const periods = useRenewalPeriods();
  const requirements = useRequirements();
  const location = useLocation();

  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(todayIso());
  const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('');

  const filtered = useMemo(
    () => (typeFilter ? activities.filter((a) => a.type === typeFilter) : activities),
    [activities, typeFilter],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    return map;
  }, [filtered]);

  const deadlines = useMemo<Deadline[]>(() => {
    const items: Deadline[] = [];
    for (const p of periods) {
      if (p.active) items.push({ date: p.endDate, label: `${p.label} ends`, to: '/ceus' });
    }
    for (const r of requirements) {
      if (r.active && r.periodEnd) items.push({ date: r.periodEnd, label: `${r.label} period ends`, to: '/requirements' });
    }
    return items;
  }, [periods, requirements]);

  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of deadlines) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [deadlines]);

  const days = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeekIso(anchor);
      return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
    }
    const monthStart = startOfMonthIso(anchor);
    const gridStart = startOfWeekIso(monthStart);
    const gridEnd = addDaysIso(startOfWeekIso(endOfMonthIso(anchor)), 6);
    const result: string[] = [];
    let cursor = gridStart;
    while (compareDateStr(cursor, gridEnd) <= 0 && result.length < 42) {
      result.push(cursor);
      cursor = addDaysIso(cursor, 1);
    }
    return result;
  }, [anchor, mode]);

  const periodLabel =
    mode === 'week'
      ? `${formatDisplayDate(days[0])} – ${formatDisplayDate(days[days.length - 1])}`
      : formatDisplayDate(startOfMonthIso(anchor));

  const shiftPeriod = (direction: -1 | 1) => {
    if (mode === 'week') setAnchor(addDaysIso(anchor, direction * 7));
    else {
      const d = new Date(startOfMonthIso(anchor));
      d.setMonth(d.getMonth() + direction);
      setAnchor(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
  };

  const today = todayIso();

  const renderDay = (day: string, dimmed: boolean) => {
    const dayActivities = byDate.get(day) ?? [];
    const dayDeadlines = deadlinesByDate.get(day) ?? [];
    const isToday = day === today;
    return (
      <div
        key={day}
        className={`min-h-24 border-b border-r border-app-border p-1.5 sm:min-h-28 ${
          dimmed ? 'bg-gray-50/60' : 'bg-white'
        } ${isToday ? 'ring-1 ring-inset ring-app-primary' : ''}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${dimmed ? 'text-app-muted' : isToday ? 'text-app-primary' : 'text-app-text'}`}
          >
            {mode === 'month' ? formatShortDate(day) : `${formatShortDate(day)}`}
          </span>
          {dayActivities.length > 0 && (
            <span className="text-[10px] text-app-muted">{formatDuration(dayActivities.reduce((s, a) => s + a.durationMinutes, 0))}</span>
          )}
        </div>
        <ul className="space-y-1">
          {dayActivities.slice(0, 3).map((a) => (
            <li key={a.id}>
              <Link
                to={`/activities/${a.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_STYLE[a.type]}`}
                title={`${a.title} — ${formatDuration(a.durationMinutes)}`}
              >
                {a.startTime ? `${a.startTime} ` : ''}
                {a.title}
              </Link>
            </li>
          ))}
          {dayActivities.length > 3 && (
            <li className="text-[10px] text-app-muted">+{dayActivities.length - 3} more</li>
          )}
          {dayDeadlines.map((d) => (
            <li key={`${d.date}-${d.label}`}>
              <Link
                to={d.to}
                className="block truncate rounded bg-app-warning-light px-1.5 py-0.5 text-[11px] font-medium text-app-warning"
                title={d.label}
              >
                ⏰ {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="One place for your activities, supervision and upcoming deadlines."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="Filter by activity type"
              className="w-auto"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ActivityType | '')}
            >
              <option value="">All activities</option>
              <option value="clinical">Clinical only</option>
              <option value="supervision">Supervision only</option>
              <option value="other">Other only</option>
            </Select>
            <div className="flex overflow-hidden rounded-lg border border-app-border bg-white">
              {(['month', 'week', 'list'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`px-3 py-2 text-sm font-medium capitalize ${
                    mode === m ? 'bg-app-primary text-white' : 'text-app-muted hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {mode !== 'list' && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => shiftPeriod(-1)} aria-label="Previous period">
              ←
            </Button>
            <Button variant="secondary" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => shiftPeriod(1)} aria-label="Next period">
              →
            </Button>
          </div>
          <p className="text-sm font-semibold">{periodLabel}</p>
        </div>
      )}

      {mode === 'list' ? (
        <ActivityListView activities={filtered} deadlines={deadlines} />
      ) : (
        <Card className="overflow-hidden p-0">
          {(mode === 'month' || mode === 'week') && (
            <div className="grid grid-cols-7 border-b border-app-border bg-gray-50">
              {dayNames.map((d) => (
                <div key={d} className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-app-muted">
                  {d}
                </div>
              ))}
            </div>
          )}
          <div className={mode === 'month' ? 'grid grid-cols-7' : 'grid grid-cols-7'}>
            {days.map((day) => renderDay(day, mode === 'month' && !day.startsWith(anchor.slice(0, 7))))}
          </div>
        </Card>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-app-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-app-primary-light ring-1 ring-app-primary/30" /> Clinical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-app-secondary-light ring-1 ring-app-secondary/30" /> Supervision
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-app-warning-light ring-1 ring-app-warning/30" /> Deadline
        </span>
        <span>Times shown in your device’s local time.</span>
      </div>
    </div>
  );
}

function ActivityListView({ activities, deadlines }: { activities: Activity[]; deadlines: Deadline[] }) {
  const location = useLocation();
  const sorted = useMemo(
    () => [...activities].sort((a, b) => b.date.localeCompare(a.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [activities],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of sorted) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return [...map.entries()];
  }, [sorted]);

  const upcoming = deadlines
    .filter((d) => compareDateStr(d.date, todayIso()) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (grouped.length === 0) {
    return (
      <Card>
        <h3>No activities in this view</h3>
        <p className="mt-1 text-sm text-app-muted">
          {activities.length === 0
            ? 'Log an activity and it will appear here on the calendar.'
            : 'Try clearing the activity-type filter above.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ul className="space-y-4 lg:col-span-2">
        {grouped.map(([date, items]) => (
          <li key={date}>
            <p className="mb-1.5 text-sm font-semibold">{formatDisplayDate(date)}</p>
            <ul className="card divide-y divide-app-border overflow-hidden">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/activities/${a.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-app-primary-light/50"
                  >
                    <span className="w-14 shrink-0 text-sm text-app-muted">{a.startTime ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <Badge tone={a.type === 'supervision' ? 'info' : a.type === 'clinical' ? 'success' : 'neutral'}>
                      {TYPE_LABEL[a.type]}
                    </Badge>
                    <span className="w-16 shrink-0 text-right text-sm font-semibold">
                      {formatDuration(a.durationMinutes)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Card className="h-fit">
        <h3 className="mb-2">Upcoming deadlines</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-app-muted">No upcoming deadlines configured.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((d) => (
              <li key={`${d.date}-${d.label}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{d.label}</span>
                <Link to={d.to} className="shrink-0 font-medium text-app-warning underline">
                  {formatDisplayDate(d.date)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Helper used by tests: checks whether a record falls inside a date range. */
export function activityInRange(activity: Activity, start: string | null, end: string | null): boolean {
  return isWithinRange(activity.date, start, end);
}
