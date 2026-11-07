/**
 * Report Studio domain — every report is built from the same summarisation
 * functions used by the dashboard and the Requirements page.
 */
import { format } from 'date-fns';
import { summarizeActivities } from './summary';
import { allRequirementProgress, filterToPeriod, computeProgress } from './progress';
import { summarizeCeus, renewalProgress } from './ceu';
import { formatHoursDecimal } from './duration';
import type {
  Activity,
  ActivityType,
  AppSettings,
  Category,
  CeURecord,
  RenewalPeriod,
  Requirement,
} from './types';

export type ReportType =
  | 'clinical_hours'
  | 'direct_indirect'
  | 'supervision'
  | 'ceu'
  | 'date_range'
  | 'category_summary'
  | 'requirement_progress';

export const REPORT_LABELS: Record<ReportType, string> = {
  clinical_hours: 'Clinical hours report',
  direct_indirect: 'Direct and indirect summary',
  supervision: 'Supervision report',
  ceu: 'CEU report',
  date_range: 'Date-range report',
  category_summary: 'Category summary',
  requirement_progress: 'Requirements progress report',
};

export interface ReportFilters {
  start: string | null;
  end: string | null;
  /** null = all activity types. */
  activityTypes: ActivityType[] | null;
  /** null = all categories. */
  categoryIds: string[] | null;
}

export const DEFAULT_FILTERS: ReportFilters = {
  start: null,
  end: null,
  activityTypes: null,
  categoryIds: null,
};

export interface ReportRow {
  label: string;
  count: number;
  /** Minutes for hour-based rows. */
  minutes: number;
  /** CEU credits for CEU rows. */
  credits: number;
  /** Optional target (requirement reports). */
  targetMinutes: number | null;
  /** Optional progress percent (requirement reports). */
  percent: number | null;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  generatedAt: string;
  filters: ReportFilters;
  rows: ReportRow[];
  totals: {
    count: number;
    minutes: number;
    hours: string;
    credits: number;
  };
}

export interface ReportInput {
  type: ReportType;
  filters: ReportFilters;
  activities: readonly Activity[];
  categories: readonly Category[];
  ceus: readonly CeURecord[];
  requirements: readonly Requirement[];
  renewalPeriods: readonly RenewalPeriod[];
  settings: Pick<AppSettings, 'includeSupervisionInClinicalTotal'>;
  now?: Date;
}

function applyFilters(input: ReportInput): Activity[] {
  const { start, end, activityTypes, categoryIds } = input.filters;
  let rows = filterToPeriod(input.activities, start, end);
  if (activityTypes && activityTypes.length > 0) {
    rows = rows.filter((a) => activityTypes.includes(a.type));
  }
  if (categoryIds && categoryIds.length > 0) {
    rows = rows.filter((a) => a.categoryId !== null && categoryIds.includes(a.categoryId));
  }
  return rows;
}

function row(label: string, partial: Partial<ReportRow> = {}): ReportRow {
  return {
    label,
    count: partial.count ?? 0,
    minutes: partial.minutes ?? 0,
    credits: partial.credits ?? 0,
    targetMinutes: partial.targetMinutes ?? null,
    percent: partial.percent ?? null,
  };
}

export function buildReport(input: ReportInput): ReportResult {
  const activities = applyFilters(input);
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const summary = summarizeActivities(activities, input.categories, input.settings);
  const ceuSummary = summarizeCeus(input.ceus);
  const generatedAt = format(input.now ?? new Date(), 'MMM d, yyyy h:mm a');

  let rows: ReportRow[] = [];

  switch (input.type) {
    case 'clinical_hours':
      rows = [
        row('Total clinical hours', { minutes: summary.clinicalMinutes, count: summary.count }),
        row('Direct hours', { minutes: summary.directMinutes }),
        row('Indirect hours', { minutes: summary.indirectMinutes }),
        row('Supervision hours', { minutes: summary.supervisionMinutes }),
        row('Other activities', { minutes: summary.otherMinutes }),
        row('Not yet classified', { minutes: summary.unclassifiedMinutes }),
      ];
      break;

    case 'direct_indirect':
      rows = [
        row('Direct hours', { minutes: summary.directMinutes }),
        row('Indirect hours', { minutes: summary.indirectMinutes }),
        ...input.categories
          .filter((c) => c.kind === 'direct' || c.kind === 'indirect')
          .map((c) =>
            row(c.label, {
              minutes: summary.byCategory[c.id] ?? 0,
              count: activities.filter((a) => a.categoryId === c.id).length,
            }),
          ),
      ];
      break;

    case 'supervision':
      rows = [
        row('Total supervision', { minutes: summary.supervisionMinutes }),
        row('Individual supervision', { minutes: summary.individualSupervisionMinutes }),
        row('Group supervision', { minutes: summary.groupSupervisionMinutes }),
        ...input.categories
          .filter((c) => c.kind === 'individual_supervision' || c.kind === 'group_supervision')
          .map((c) =>
            row(c.label, {
              minutes: summary.byCategory[c.id] ?? 0,
              count: activities.filter((a) => a.categoryId === c.id).length,
            }),
          ),
      ];
      break;

    case 'ceu': {
      const byCategory = Object.entries(ceuSummary.byCategory).sort((a, b) => b[1] - a[1]);
      rows = byCategory.map(([label, credits]) => row(label, { credits, count: 0 }));
      rows.push(row('Total CEU credits', { credits: ceuSummary.totalCredits, count: ceuSummary.count }));
      break;
    }

    case 'date_range': {
      const byMonth = new Map<string, { minutes: number; count: number }>();
      for (const a of activities) {
        const key = a.date.slice(0, 7); // yyyy-MM
        const bucket = byMonth.get(key) ?? { minutes: 0, count: 0 };
        bucket.minutes += a.durationMinutes;
        bucket.count += 1;
        byMonth.set(key, bucket);
      }
      rows = [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, bucket]) => row(month, { minutes: bucket.minutes, count: bucket.count }));
      break;
    }

    case 'category_summary': {
      const counts = new Map<string, number>();
      for (const a of activities) {
        if (!a.categoryId) continue;
        counts.set(a.categoryId, (counts.get(a.categoryId) ?? 0) + 1);
      }
      rows = Object.entries(summary.byCategory)
        .map(([categoryId, minutes]) =>
          row(categoryById.get(categoryId)?.label ?? 'Removed category', {
            minutes,
            count: counts.get(categoryId) ?? 0,
          }),
        )
        .sort((a, b) => b.minutes - a.minutes);
      if (summary.unclassifiedMinutes > 0) {
        rows.push(row('Not yet classified', { minutes: summary.unclassifiedMinutes }));
      }
      break;
    }

    case 'requirement_progress':
      rows = allRequirementProgress(input.requirements, activities, input.categories, input.settings).map(
        ({ requirement, progress }) =>
          row(requirement.label, {
            minutes: progress.completedMinutes,
            targetMinutes: progress.targetMinutes,
            percent: progress.percent,
          }),
      );
      break;
  }

  const totals =
    input.type === 'ceu'
      ? {
          count: ceuSummary.count,
          minutes: 0,
          hours: '0',
          credits: ceuSummary.totalCredits,
        }
      : {
          count: input.type === 'requirement_progress' ? rows.length : summary.count,
          minutes: input.type === 'clinical_hours' ? summary.clinicalMinutes : summary.totalTrackedMinutes,
          hours: formatHoursDecimal(input.type === 'clinical_hours' ? summary.clinicalMinutes : summary.totalTrackedMinutes),
          credits: 0,
        };

  return {
    type: input.type,
    title: REPORT_LABELS[input.type],
    generatedAt,
    filters: input.filters,
    rows,
    totals,
  };
}

/** Human description of the active filters (used in CSV/print headers). */
export function describeFilters(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.start || filters.end) {
    parts.push(`Dates: ${filters.start ?? 'beginning'} to ${filters.end ?? 'today'}`);
  } else {
    parts.push('Dates: all time');
  }
  parts.push(
    `Types: ${filters.activityTypes && filters.activityTypes.length > 0 ? filters.activityTypes.join(', ') : 'all'}`,
  );
  parts.push(`Categories: ${filters.categoryIds && filters.categoryIds.length > 0 ? `${filters.categoryIds.length} selected` : 'all'}`);
  return parts.join(' · ');
}

/** Renewal-period progress rows for the CEU report. */
export function renewalRows(
  periods: readonly RenewalPeriod[],
  ceus: readonly CeURecord[],
  now?: Date,
): Array<{ label: string; completed: number; target: number; percent: number }> {
  const today = now ? format(now, 'yyyy-MM-dd') : undefined;
  return periods.map((p) => {
    const progress = renewalProgress(p, ceus, today);
    return {
      label: p.label,
      completed: progress.completedCredits,
      target: progress.targetCredits,
      percent: computeProgress(progress.targetCredits, progress.completedCredits).percent,
    };
  });
}
