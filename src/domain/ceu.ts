/**
 * CEU domain functions.
 * CEU credits are deliberately kept separate from clinical-hour calculations —
 * nothing in this module is ever added to activity summaries.
 */
import { compareDateStr, daysBetween, todayIso } from './date';
import type { CeURecord, RenewalPeriod } from './types';

export interface CeusSummary {
  count: number;
  totalCredits: number;
  byCategory: Record<string, number>;
  /** Credits per renewal period id (only linked records). */
  byPeriod: Record<string, number>;
  /** Credits with no linked renewal period. */
  unlinkedCredits: number;
}

export const EMPTY_CEU_SUMMARY: CeusSummary = {
  count: 0,
  totalCredits: 0,
  byCategory: {},
  byPeriod: {},
  unlinkedCredits: 0,
};

export function summarizeCeus(ceus: readonly CeURecord[]): CeusSummary {
  const summary: CeusSummary = {
    count: ceus.length,
    totalCredits: 0,
    byCategory: {},
    byPeriod: {},
    unlinkedCredits: 0,
  };
  for (const ceu of ceus) {
    const credits = Number.isFinite(ceu.credits) && ceu.credits > 0 ? ceu.credits : 0;
    summary.totalCredits += credits;
    const key = ceu.category.trim() || 'Uncategorised';
    summary.byCategory[key] = (summary.byCategory[key] ?? 0) + credits;
    if (ceu.renewalPeriodId) {
      summary.byPeriod[ceu.renewalPeriodId] = (summary.byPeriod[ceu.renewalPeriodId] ?? 0) + credits;
    } else {
      summary.unlinkedCredits += credits;
    }
  }
  // Round to avoid float drift (e.g. 0.1 + 0.2).
  summary.totalCredits = roundCredits(summary.totalCredits);
  summary.unlinkedCredits = roundCredits(summary.unlinkedCredits);
  for (const k of Object.keys(summary.byCategory)) summary.byCategory[k] = roundCredits(summary.byCategory[k] as number);
  for (const k of Object.keys(summary.byPeriod)) summary.byPeriod[k] = roundCredits(summary.byPeriod[k] as number);
  return summary;
}

export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

export type RenewalStatus = 'upcoming' | 'active' | 'ended';

export interface RenewalProgress {
  period: RenewalPeriod;
  targetCredits: number;
  completedCredits: number;
  remainingCredits: number;
  percent: number;
  targetReached: boolean;
  hasTarget: boolean;
  status: RenewalStatus;
  /** Whole days until the end date (negative when already ended). */
  daysRemaining: number;
}

export function renewalStatus(period: RenewalPeriod, today = todayIso()): RenewalStatus {
  if (compareDateStr(today, period.startDate) < 0) return 'upcoming';
  if (compareDateStr(today, period.endDate) > 0) return 'ended';
  return 'active';
}

export function renewalProgress(
  period: RenewalPeriod,
  ceus: readonly CeURecord[],
  today = todayIso(),
): RenewalProgress {
  const completed = roundCredits(
    ceus
      .filter((c) => c.renewalPeriodId === period.id)
      .reduce((sum, c) => sum + (Number.isFinite(c.credits) && c.credits > 0 ? c.credits : 0), 0),
  );
  const hasTarget = period.targetCredits > 0;
  const percent = hasTarget ? Math.round((completed / period.targetCredits) * 1000) / 10 : 0;
  return {
    period,
    targetCredits: period.targetCredits,
    completedCredits: completed,
    remainingCredits: hasTarget ? Math.max(roundCredits(period.targetCredits - completed), 0) : 0,
    percent,
    targetReached: hasTarget && completed >= period.targetCredits,
    hasTarget,
    status: renewalStatus(period, today),
    daysRemaining: daysBetween(today, period.endDate),
  };
}
