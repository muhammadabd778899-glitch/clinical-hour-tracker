/**
 * Record Quality Check — explainable, read-only detection of records that
 * look incomplete or suspicious. Nothing here ever modifies data.
 */
import { compareDateStr, isDateStr } from './date';
import type { Activity, Category, CeURecord, RenewalPeriod, Requirement } from './types';

export type QualitySeverity = 'error' | 'warning';

export type QualityCode =
  | 'missing_title'
  | 'missing_classification'
  | 'inactive_category'
  | 'type_mismatch'
  | 'invalid_time_range'
  | 'invalid_duration'
  | 'zero_duration'
  | 'overlapping_activity'
  | 'duplicate_looking'
  | 'activity_outside_periods'
  | 'incomplete_ceu'
  | 'ceu_outside_period';

export interface QualityIssue {
  /** Stable id so lists can be keyed safely: `code:recordId`. */
  id: string;
  code: QualityCode;
  severity: QualitySeverity;
  recordType: 'activity' | 'ceu';
  recordId: string;
  /** Human-friendly label of the affected record. */
  recordLabel: string;
  message: string;
}

export interface QualityCheckInput {
  activities: readonly Activity[];
  categories: readonly Category[];
  ceus: readonly CeURecord[];
  renewalPeriods: readonly RenewalPeriod[];
  requirements: readonly Requirement[];
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function overlaps(a: Activity, b: Activity): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function activityLabel(a: Activity): string {
  return a.title.trim() || 'Untitled activity';
}

export function runQualityCheck(input: QualityCheckInput): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const periodById = new Map(input.renewalPeriods.map((p) => [p.id, p]));

  // Configured periods from requirements (only fully configured ones).
  const configuredPeriods = input.requirements
    .filter((r) => r.active && r.periodStart && r.periodEnd)
    .map((r) => ({ start: r.periodStart as string, end: r.periodEnd as string, label: r.label }));

  const push = (issue: Omit<QualityIssue, 'id'>) => {
    issues.push({ ...issue, id: `${issue.code}:${issue.recordId}` });
  };

  for (const activity of input.activities) {
    const label = activityLabel(activity);
    const recordId = activity.id;

    if (!activity.title.trim()) {
      push({
        code: 'missing_title',
        severity: 'error',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'This activity has no title, so it will be hard to recognise in reports.',
      });
    }

    const category = activity.categoryId ? categoryById.get(activity.categoryId) : undefined;
    if (!activity.categoryId) {
      push({
        code: 'missing_classification',
        severity: 'warning',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'This activity has no category, so its hours are not counted toward any target.',
      });
    } else if (!category) {
      push({
        code: 'missing_classification',
        severity: 'warning',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'This activity points to a category that no longer exists, so its hours are not counted.',
      });
    } else if (!category.active) {
      push({
        code: 'inactive_category',
        severity: 'warning',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: `Category "${category.label}" is turned off, so these hours are not counted toward targets.`,
      });
    } else if (
      (activity.type === 'clinical' && category.kind !== 'direct' && category.kind !== 'indirect') ||
      (activity.type === 'supervision' &&
        category.kind !== 'individual_supervision' &&
        category.kind !== 'group_supervision') ||
      (activity.type === 'other' && category.kind !== 'other')
    ) {
      push({
        code: 'type_mismatch',
        severity: 'warning',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: `Category "${category.label}" does not match this activity type, so these hours are not counted.`,
      });
    }

    if (activity.startTime && activity.endTime && activity.startTime >= activity.endTime) {
      push({
        code: 'invalid_time_range',
        severity: 'error',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'The end time is not after the start time.',
      });
    }

    if (!Number.isInteger(activity.durationMinutes) || activity.durationMinutes > 24 * 60) {
      push({
        code: 'invalid_duration',
        severity: 'error',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'The recorded duration is not a valid number of minutes.',
      });
    } else if (activity.durationMinutes <= 0) {
      push({
        code: 'zero_duration',
        severity: 'error',
        recordType: 'activity',
        recordId,
        recordLabel: label,
        message: 'This activity has a zero or negative duration, so it adds no hours.',
      });
    }

    if (configuredPeriods.length > 0) {
      const inside = configuredPeriods.some(
        (p) => compareDateStr(activity.date, p.start) >= 0 && compareDateStr(activity.date, p.end) <= 0,
      );
      if (!inside) {
        push({
          code: 'activity_outside_periods',
          severity: 'warning',
          recordType: 'activity',
          recordId,
          recordLabel: label,
          message: 'This activity falls outside every configured target period, so it may not count toward them.',
        });
      }
    }
  }

  // Overlaps and duplicates (pairwise — activity counts are modest by design).
  for (let i = 0; i < input.activities.length; i++) {
    const a = input.activities[i]!;
    for (let j = i + 1; j < input.activities.length; j++) {
      const b = input.activities[j]!;
      if (a.date !== b.date) continue;

      if (overlaps(a, b)) {
        const later = compareTime(a.startTime, b.startTime) >= 0 ? a : b;
        const earlier = later === a ? b : a;
        push({
          code: 'overlapping_activity',
          severity: 'warning',
          recordType: 'activity',
          recordId: later.id,
          recordLabel: activityLabel(later),
          message: `This activity overlaps with "${activityLabel(earlier)}" (${earlier.startTime}–${earlier.endTime}) on the same day.`,
        });
      }

      if (
        a.id !== b.id &&
        a.durationMinutes === b.durationMinutes &&
        a.durationMinutes > 0 &&
        normalizeTitle(a.title) === normalizeTitle(b.title) &&
        a.title.trim() !== ''
      ) {
        const laterCreated = a.createdAt >= b.createdAt ? a : b;
        const earlierCreated = laterCreated === a ? b : a;
        push({
          code: 'duplicate_looking',
          severity: 'warning',
          recordType: 'activity',
          recordId: laterCreated.id,
          recordLabel: activityLabel(laterCreated),
          message: `This looks like a duplicate of "${activityLabel(earlierCreated)}" from the same date. Review both records.`,
        });
      }
    }
  }

  for (const ceu of input.ceus) {
    const label = ceu.title.trim() || 'Untitled CEU';
    const problems: string[] = [];
    if (!ceu.title.trim()) problems.push('a title');
    if (!ceu.provider.trim()) problems.push('a provider');
    if (!ceu.category.trim()) problems.push('a category');
    if (!(ceu.credits > 0)) problems.push('a credit amount greater than zero');
    if (!isDateStr(ceu.completionDate)) problems.push('a valid completion date');

    if (problems.length > 0) {
      push({
        code: 'incomplete_ceu',
        severity: 'error',
        recordType: 'ceu',
        recordId: ceu.id,
        recordLabel: label,
        message: `This CEU record is missing ${problems.join(', ')}.`,
      });
    }

    if (ceu.renewalPeriodId) {
      const period = periodById.get(ceu.renewalPeriodId);
      if (period && isDateStr(ceu.completionDate)) {
        const outside =
          compareDateStr(ceu.completionDate, period.startDate) < 0 ||
          compareDateStr(ceu.completionDate, period.endDate) > 0;
        if (outside) {
          push({
            code: 'ceu_outside_period',
            severity: 'warning',
            recordType: 'ceu',
            recordId: ceu.id,
            recordLabel: label,
            message: `This completion date falls outside the linked period "${period.label}".`,
          });
        }
      }
    }
  }

  const severityRank: Record<QualitySeverity, number> = { error: 0, warning: 1 };
  return issues.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.recordLabel.localeCompare(b.recordLabel) ||
      a.code.localeCompare(b.code),
  );
}

function compareTime(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return a.localeCompare(b);
}

export interface QualitySummary {
  total: number;
  errors: number;
  warnings: number;
}

export function summarizeIssues(issues: readonly QualityIssue[]): QualitySummary {
  return {
    total: issues.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
  };
}
