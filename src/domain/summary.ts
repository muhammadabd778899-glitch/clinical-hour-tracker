/**
 * Classification and summarisation — the single source of truth for how
 * activities roll up into clinical / supervision / other totals.
 *
 * Business rules (docs/DOMAIN_RULES.md):
 * - Every activity references a category; the category's `kind` decides the bucket.
 * - An activity only counts when its `type` matches its category kind:
 *     clinical   -> direct | indirect
 *     supervision-> individual_supervision | group_supervision
 *     other      -> other
 * - Anything else is "unclassified": it never inflates clinical totals and is
 *   surfaced by the Record Quality Check instead.
 * - CEUs are never part of this summary.
 */
import type { Activity, ActivityCategoryKind, ActivityType, AppSettings, Category, SummaryBucket } from './types';

export type ClassificationReason =
  | 'ok'
  | 'missing_category'
  | 'inactive_category'
  | 'type_mismatch';

export interface ClassificationResult {
  bucket: SummaryBucket | null;
  reason: ClassificationReason;
}

const KIND_BUCKET: Record<ActivityCategoryKind, SummaryBucket> = {
  direct: 'direct',
  indirect: 'indirect',
  individual_supervision: 'individual_supervision',
  group_supervision: 'group_supervision',
  other: 'other',
};

const TYPE_KINDS: Record<ActivityType, ActivityCategoryKind[]> = {
  clinical: ['direct', 'indirect'],
  supervision: ['individual_supervision', 'group_supervision'],
  other: ['other'],
};

/** Maps a category to its summary bucket, honouring active state. */
export function resolveClassification(
  activity: Pick<Activity, 'type' | 'categoryId'>,
  category: Category | undefined,
): ClassificationResult {
  if (!activity.categoryId || !category) return { bucket: null, reason: 'missing_category' };
  if (!category.active) return { bucket: null, reason: 'inactive_category' };
  if (!TYPE_KINDS[activity.type].includes(category.kind)) {
    return { bucket: null, reason: 'type_mismatch' };
  }
  return { bucket: KIND_BUCKET[category.kind], reason: 'ok' };
}

export interface ActivitySummary {
  /** Number of activities considered. */
  count: number;
  /** Every minute tracked, including unclassified records. */
  totalTrackedMinutes: number;
  /**
   * "Total clinical hours" = direct + indirect, plus supervision when the
   * user enables `includeSupervisionInClinicalTotal`.
   */
  clinicalMinutes: number;
  directMinutes: number;
  indirectMinutes: number;
  supervisionMinutes: number;
  individualSupervisionMinutes: number;
  groupSupervisionMinutes: number;
  otherMinutes: number;
  /** Minutes in records that could not be classified (shown by Quality Check). */
  unclassifiedMinutes: number;
  /** Minutes per category id (classified records only). */
  byCategory: Record<string, number>;
  /** Raw minutes per activity type, regardless of classification. */
  byType: Record<ActivityType, number>;
}

export const EMPTY_SUMMARY: ActivitySummary = {
  count: 0,
  totalTrackedMinutes: 0,
  clinicalMinutes: 0,
  directMinutes: 0,
  indirectMinutes: 0,
  supervisionMinutes: 0,
  individualSupervisionMinutes: 0,
  groupSupervisionMinutes: 0,
  otherMinutes: 0,
  unclassifiedMinutes: 0,
  byCategory: {},
  byType: { clinical: 0, supervision: 0, other: 0 },
};

function indexCategories(categories: readonly Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * Summarises activities into buckets.
 * Pure function — used by dashboard, requirements, reports and quality check.
 */
export function summarizeActivities(
  activities: readonly Activity[],
  categories: readonly Category[],
  settings?: Pick<AppSettings, 'includeSupervisionInClinicalTotal'>,
): ActivitySummary {
  const byId = indexCategories(categories);
  const includeSupervision = settings?.includeSupervisionInClinicalTotal ?? false;

  const summary: ActivitySummary = {
    ...EMPTY_SUMMARY,
    byCategory: {},
    byType: { clinical: 0, supervision: 0, other: 0 },
    count: activities.length,
  };

  for (const activity of activities) {
    const minutes = Number.isFinite(activity.durationMinutes) ? activity.durationMinutes : 0;
    summary.totalTrackedMinutes += minutes;
    summary.byType[activity.type] += minutes;

    const { bucket } = resolveClassification(activity, byId.get(activity.categoryId ?? ''));
    if (!bucket) {
      summary.unclassifiedMinutes += minutes;
      continue;
    }
    summary.byCategory[activity.categoryId as string] =
      (summary.byCategory[activity.categoryId as string] ?? 0) + minutes;

    switch (bucket) {
      case 'direct':
        summary.directMinutes += minutes;
        break;
      case 'indirect':
        summary.indirectMinutes += minutes;
        break;
      case 'individual_supervision':
        summary.individualSupervisionMinutes += minutes;
        break;
      case 'group_supervision':
        summary.groupSupervisionMinutes += minutes;
        break;
      case 'other':
        summary.otherMinutes += minutes;
        break;
    }
  }

  summary.supervisionMinutes = summary.individualSupervisionMinutes + summary.groupSupervisionMinutes;
  summary.clinicalMinutes =
    summary.directMinutes +
    summary.indirectMinutes +
    (includeSupervision ? summary.supervisionMinutes : 0);

  return summary;
}

/** Minutes recorded for a single category id (classified records only). */
export function minutesForCategory(summary: ActivitySummary, categoryId: string): number {
  return summary.byCategory[categoryId] ?? 0;
}
