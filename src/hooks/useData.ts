/** Live data hooks — pages subscribe through these instead of touching Dexie. */
import { useLiveQuery } from 'dexie-react-hooks';
import {
  activityRepository,
  categoryRepository,
  ceuRepository,
  renewalPeriodRepository,
  requirementRepository,
  settingsRepository,
} from '@/repositories';
import { getDB } from '@/db/database';
import { DEFAULT_SETTINGS } from '@/domain/types';
import type { Activity, Category, CeURecord, RenewalPeriod, Requirement } from '@/domain/types';
import { runQualityCheckForUser } from '@/services/quality';
import type { QualityIssue } from '@/domain/quality';

const EMPTY_ACTIVITIES: Activity[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];
const EMPTY_PERIODS: RenewalPeriod[] = [];
const EMPTY_CEUS: CeURecord[] = [];
const EMPTY_ISSUES: QualityIssue[] = [];

export function useActivities(): Activity[] {
  return useLiveQuery(() => activityRepository.list(), [], EMPTY_ACTIVITIES) ?? EMPTY_ACTIVITIES;
}

export function useCategories(): Category[] {
  return useLiveQuery(() => categoryRepository.list(), [], EMPTY_CATEGORIES) ?? EMPTY_CATEGORIES;
}

export function useRequirements(): Requirement[] {
  return useLiveQuery(() => requirementRepository.list(), [], EMPTY_REQUIREMENTS) ?? EMPTY_REQUIREMENTS;
}

export function useRenewalPeriods(): RenewalPeriod[] {
  return useLiveQuery(() => renewalPeriodRepository.list(), [], EMPTY_PERIODS) ?? EMPTY_PERIODS;
}

export function useCeus(): CeURecord[] {
  return useLiveQuery(() => ceuRepository.list(), [], EMPTY_CEUS) ?? EMPTY_CEUS;
}

export function useSettings(): typeof DEFAULT_SETTINGS | undefined {
  return useLiveQuery(() => settingsRepository.get('app', DEFAULT_SETTINGS), [], undefined);
}

export function useQualityIssues(): QualityIssue[] {
  return useLiveQuery(() => runQualityCheckForUser(), [], EMPTY_ISSUES) ?? EMPTY_ISSUES;
}

/** Single activity by stable id; undefined while loading. */
export function useActivity(id: string | undefined): Activity | null | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return null;
      const record = await activityRepository.getById(id);
      return record ?? null;
    },
    [id],
    undefined,
  );
}

export function useCeu(id: string | undefined): CeURecord | null | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return null;
      const record = await ceuRepository.getById(id);
      return record ?? null;
    },
    [id],
    undefined,
  );
}

/** Overall record counts for the Overview empty state. */
export function useCounts(): { activities: number; ceus: number; requirements: number } {
  const db = getDB();
  const activities = useLiveQuery(() => db.activities.count(), [], 0) ?? 0;
  const ceus = useLiveQuery(() => db.ceus.count(), [], 0) ?? 0;
  const requirements = useLiveQuery(() => db.requirements.count(), [], 0) ?? 0;
  return { activities, ceus, requirements };
}
