/**
 * Requirement progress — one shared calculation used by the dashboard,
 * the Requirements page and every report. Never duplicate these formulas.
 */
import { isWithinRange } from './date';
import { summarizeActivities } from './summary';
import type { Activity, AppSettings, Category, Requirement } from './types';

export interface ProgressResult {
  targetMinutes: number;
  completedMinutes: number;
  /** `max(target - completed, 0)`. */
  remainingMinutes: number;
  /** 0–100+ rounded to one decimal. 0 when no target is configured. */
  percent: number;
  targetReached: boolean;
  /** False when targetMinutes <= 0 ("no target set"). */
  hasTarget: boolean;
}

export function computeProgress(targetMinutes: number, completedMinutes: number): ProgressResult {
  const hasTarget = Number.isFinite(targetMinutes) && targetMinutes > 0;
  const completed = Number.isFinite(completedMinutes) && completedMinutes > 0 ? completedMinutes : 0;
  const target = hasTarget ? targetMinutes : 0;
  const percent = hasTarget ? Math.round((completed / target) * 1000) / 10 : 0;
  return {
    targetMinutes: target,
    completedMinutes: completed,
    remainingMinutes: Math.max(target - completed, 0),
    percent,
    targetReached: hasTarget && completed >= target,
    hasTarget,
  };
}

/** Filters activities into a requirement's configured period (inclusive). */
export function filterToPeriod(
  activities: readonly Activity[],
  periodStart: string | null,
  periodEnd: string | null,
): Activity[] {
  if (!periodStart && !periodEnd) return [...activities];
  return activities.filter((a) => isWithinRange(a.date, periodStart, periodEnd));
}

/** Resolves which completed minutes satisfy a requirement. */
export function completedMinutesForRequirement(
  requirement: Requirement,
  activities: readonly Activity[],
  categories: readonly Category[],
  settings?: Pick<AppSettings, 'includeSupervisionInClinicalTotal'>,
): number {
  const inPeriod = filterToPeriod(activities, requirement.periodStart, requirement.periodEnd);
  const summary = summarizeActivities(inPeriod, categories, settings);
  switch (requirement.kind) {
    case 'clinical_total':
      return summary.clinicalMinutes;
    case 'direct':
      return summary.directMinutes;
    case 'indirect':
      return summary.indirectMinutes;
    case 'supervision_total':
      return summary.supervisionMinutes;
    case 'individual_supervision':
      return summary.individualSupervisionMinutes;
    case 'group_supervision':
      return summary.groupSupervisionMinutes;
    case 'custom_category':
      return requirement.categoryId ? (summary.byCategory[requirement.categoryId] ?? 0) : 0;
    default:
      return 0;
  }
}

/** Progress for one requirement. The only place progress math happens. */
export function requirementProgress(
  requirement: Requirement,
  activities: readonly Activity[],
  categories: readonly Category[],
  settings?: Pick<AppSettings, 'includeSupervisionInClinicalTotal'>,
): ProgressResult {
  const completed = completedMinutesForRequirement(requirement, activities, categories, settings);
  return computeProgress(requirement.targetMinutes, completed);
}

export interface ProgressRow {
  requirement: Requirement;
  progress: ProgressResult;
}

/** Progress for every active requirement, sorted by percent descending. */
export function allRequirementProgress(
  requirements: readonly Requirement[],
  activities: readonly Activity[],
  categories: readonly Category[],
  settings?: Pick<AppSettings, 'includeSupervisionInClinicalTotal'>,
): ProgressRow[] {
  return requirements
    .filter((r) => r.active)
    .map((requirement) => ({ requirement, progress: requirementProgress(requirement, activities, categories, settings) }))
    .sort((a, b) => b.progress.percent - a.progress.percent);
}
