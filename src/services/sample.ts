/**
 * Sample workspace — a realistic, clearly-labelled demo profile.
 *
 * Rules:
 * - It can only be loaded into an empty workspace, and never twice.
 * - Every sample record id starts with `sample-`, so removal is exact and can
 *   never touch records the user created themselves.
 * - Sample data uses the app's normal categories, so the same totals and
 *   quality checks run exactly as they would on real records.
 */
import type { ZodTypeAny } from 'zod';
import { getDB, type ClinicalTrackerDB } from '@/db/database';
import {
  activitySchema,
  categorySchema,
  ceuSchema,
  renewalPeriodSchema,
  requirementSchema,
  settingsSchema,
} from '@/validation/schemas';
import { metaRepository, settingsRepository } from '@/repositories';
import { addDaysIso, compareDateStr, nowIso, startOfWeekIso, todayIso } from '@/domain/date';
import { hoursToMinutes } from '@/domain/duration';
import type { Activity, AppSettings, Category, CeURecord, RenewalPeriod, Requirement } from '@/domain/types';
import { newId } from '@/lib/id';
import { ServiceError } from './errors';

export const SAMPLE_ID_PREFIX = 'sample-';
export const SAMPLE_META_KEY = 'sampleWorkspace';
export const SAMPLE_DISPLAY_NAME = 'Alex';
export const SAMPLE_PROFESSION = 'Counseling / psychology student';

export interface SampleState {
  active: boolean;
  loadedAt: string | null;
}

const INACTIVE: SampleState = { active: false, loadedAt: null };

export async function getSampleState(db: ClinicalTrackerDB = getDB()): Promise<SampleState> {
  const stored = await metaRepository.get<SampleState>(SAMPLE_META_KEY, INACTIVE, db);
  return stored?.active ? stored : INACTIVE;
}

interface SampleCounts {
  activities: number;
  ceus: number;
  requirements: number;
  renewalPeriods: number;
}

export async function sampleCounts(db: ClinicalTrackerDB = getDB()): Promise<SampleCounts> {
  const [activities, ceus, requirements, renewalPeriods] = await Promise.all([
    db.activities.count(),
    db.ceus.count(),
    db.requirements.count(),
    db.renewalPeriods.count(),
  ]);
  return { activities, ceus, requirements, renewalPeriods };
}

/** Sample data needs a clean slate so its totals are never mixed with real records. */
export async function canLoadSampleWorkspace(db: ClinicalTrackerDB = getDB()): Promise<boolean> {
  const state = await getSampleState(db);
  if (state.active) return false;
  const counts = await sampleCounts(db);
  return counts.activities === 0 && counts.ceus === 0 && counts.requirements === 0 && counts.renewalPeriods === 0;
}

interface WeekPlanRow {
  /** 0 = Monday. */
  day: number;
  type: Activity['type'];
  kind: Category['kind'];
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  location: string;
  notes: string | null;
  /** Only include every Nth week (1 = every week). */
  every?: number;
}

const WEEK_PLAN: WeekPlanRow[] = [
  {
    day: 0,
    type: 'clinical',
    kind: 'direct',
    title: 'Individual counselling block',
    start: '09:00',
    end: '12:00',
    durationMinutes: 180,
    location: 'Campus clinic',
    notes: 'Two 50-minute sessions with documentation time between.',
  },
  {
    day: 0,
    type: 'clinical',
    kind: 'indirect',
    title: 'Progress notes & treatment planning',
    start: '13:00',
    end: '14:00',
    durationMinutes: 60,
    location: 'Campus clinic',
    notes: null,
  },
  {
    day: 1,
    type: 'clinical',
    kind: 'direct',
    title: 'Intake & assessment sessions',
    start: '09:00',
    end: '11:00',
    durationMinutes: 120,
    location: 'Campus clinic',
    notes: null,
  },
  {
    day: 1,
    type: 'other',
    kind: 'other',
    title: 'Multidisciplinary case conference',
    start: '14:00',
    end: '15:00',
    durationMinutes: 60,
    location: 'Team room',
    notes: 'Weekly team meeting.',
    every: 2,
  },
  {
    day: 2,
    type: 'clinical',
    kind: 'direct',
    title: 'Group therapy session',
    start: '09:00',
    end: '10:30',
    durationMinutes: 90,
    location: 'Community centre',
    notes: null,
  },
  {
    day: 2,
    type: 'clinical',
    kind: 'indirect',
    title: 'Case documentation & referrals',
    start: '11:00',
    end: '11:45',
    durationMinutes: 45,
    location: 'Campus clinic',
    notes: null,
  },
  {
    day: 3,
    type: 'clinical',
    kind: 'direct',
    title: 'Individual counselling block',
    start: '09:00',
    end: '11:30',
    durationMinutes: 150,
    location: 'Telehealth',
    notes: null,
  },
  {
    day: 3,
    type: 'supervision',
    kind: 'individual_supervision',
    title: 'Individual supervision',
    start: '13:00',
    end: '14:00',
    durationMinutes: 60,
    location: 'Supervision room',
    notes: 'Weekly one-to-one supervision.',
  },
  {
    day: 4,
    type: 'clinical',
    kind: 'indirect',
    title: 'Treatment planning & referrals',
    start: '09:00',
    end: '10:30',
    durationMinutes: 90,
    location: 'Campus clinic',
    notes: null,
  },
  {
    day: 4,
    type: 'supervision',
    kind: 'group_supervision',
    title: 'Group supervision',
    start: '11:00',
    end: '12:30',
    durationMinutes: 90,
    location: 'Seminar room',
    notes: 'Peer case discussion.',
    every: 2,
  },
];

const WEEKS = 12;

const CEU_PLAN: Array<{
  title: string;
  provider: string;
  daysAgo: number;
  credits: number;
  category: string;
  certificateRef: string | null;
  notes: string | null;
}> = [
  {
    title: 'Trauma-Informed Care Workshop',
    provider: 'State Counseling Association',
    daysAgo: 18,
    credits: 6,
    category: 'Trauma',
    certificateRef: 'TIC-24-1180',
    notes: 'Two-day workshop with case discussion.',
  },
  {
    title: 'Ethics in Telehealth Practice',
    provider: 'NBCC',
    daysAgo: 41,
    credits: 3,
    category: 'Ethics',
    certificateRef: 'ETH-24-0921',
    notes: null,
  },
  {
    title: 'Motivational Interviewing Level 1',
    provider: 'MINT',
    daysAgo: 74,
    credits: 12,
    category: 'Clinical skills',
    certificateRef: 'MI-1-3388',
    notes: 'Includes observed practice sessions.',
  },
  {
    title: 'Suicide Risk Assessment & Safety Planning',
    provider: 'QPR Institute',
    daysAgo: 96,
    credits: 4,
    category: 'Crisis response',
    certificateRef: 'QPR-77-204',
    notes: null,
  },
  {
    title: 'Cultural Responsiveness in Counselling',
    provider: 'American Counseling Association',
    daysAgo: 132,
    credits: 3.5,
    category: 'Multicultural',
    certificateRef: null,
    notes: null,
  },
  {
    title: 'Documentation That Protects You',
    provider: 'SimplePractice Learning',
    daysAgo: 168,
    credits: 2,
    category: 'Documentation',
    certificateRef: 'DOC-51-882',
    notes: null,
  },
];

function validateRecord<T>(schema: ZodTypeAny, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ServiceError('validation', `The sample ${label} could not be prepared: ${parsed.error.issues[0]?.message ?? 'invalid data'}`);
  }
  return parsed.data as T;
}

function buildSampleRecords(
  categories: Category[],
  today: string,
): {
  activities: Activity[];
  requirements: Requirement[];
  renewalPeriods: RenewalPeriod[];
  ceus: CeURecord[];
  missingKind?: Category['kind'];
} {
  const byKind = new Map(categories.map((c) => [c.kind, c]));
  const needed: Category['kind'][] = [
    'direct',
    'indirect',
    'individual_supervision',
    'group_supervision',
    'other',
  ];
  const missingKind = needed.find((kind) => !byKind.get(kind));

  const weekStart = startOfWeekIso(today);
  const earliest = addDaysIso(weekStart, -7 * (WEEKS - 1));
  const periodStart = earliest;
  const periodEnd = addDaysIso(today, 120);

  const activities: Activity[] = [];
  for (let week = 0; week < WEEKS; week++) {
    WEEK_PLAN.forEach((row, rowIndex) => {
      if (row.every && week % row.every !== 0) return;
      const date = addDaysIso(weekStart, -7 * week + row.day);
      if (compareDateStr(date, today) > 0) return;
      const category = byKind.get(row.kind);
      if (!category) return;
      activities.push({
        id: `${SAMPLE_ID_PREFIX}act-w${week + 1}-${rowIndex + 1}`,
        type: row.type,
        categoryId: category.id,
        title: row.title,
        date,
        startTime: row.start,
        endTime: row.end,
        durationMinutes: row.durationMinutes,
        location: row.location,
        notes: row.notes,
        createdAt: `${date}T18:00:00.000Z`,
        updatedAt: `${date}T18:00:00.000Z`,
      });
    });
  }

  activities.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  activities.forEach((activity, index) => {
    activity.id = `${SAMPLE_ID_PREFIX}act-${String(index + 1).padStart(3, '0')}`;
  });

  const requirement = (
    id: string,
    label: string,
    kind: Requirement['kind'],
    hours: number,
  ): Requirement => ({
    id: `${SAMPLE_ID_PREFIX}${id}`,
    label,
    kind,
    categoryId: null,
    targetMinutes: hoursToMinutes(hours),
    periodStart,
    periodEnd,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const requirements = [
    requirement('req-clinical', 'Clinical hours placement target', 'clinical_total', 450),
    requirement('req-direct', 'Direct client hours', 'direct', 300),
    requirement('req-supervision', 'Supervision hours', 'supervision_total', 45),
    requirement('req-individual', 'Individual supervision', 'individual_supervision', 30),
  ];

  const year = today.slice(0, 4);
  const renewalPeriod: RenewalPeriod = {
    id: `${SAMPLE_ID_PREFIX}period-renewal`,
    label: 'Current renewal cycle',
    startDate: `${year}-01-01`,
    endDate: `${Number(year) + 1}-12-31`,
    targetCredits: 40,
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const ceus: CeURecord[] = CEU_PLAN.map((item, index) => {
    const raw = addDaysIso(today, -item.daysAgo);
    const completionDate = compareDateStr(raw, renewalPeriod.startDate) < 0 ? renewalPeriod.startDate : raw;
    return {
      id: `${SAMPLE_ID_PREFIX}ceu-${String(index + 1).padStart(2, '0')}`,
      title: item.title,
      provider: item.provider,
      completionDate,
      credits: item.credits,
      category: item.category,
      renewalPeriodId: renewalPeriod.id,
      certificateRef: item.certificateRef,
      notes: item.notes,
      createdAt: `${completionDate}T16:00:00.000Z`,
      updatedAt: `${completionDate}T16:00:00.000Z`,
    };
  });

  return { activities, requirements, renewalPeriods: [renewalPeriod], ceus, ...(missingKind ? { missingKind } : {}) };
}

/**
 * Writes the demo profile. Throws a friendly ServiceError when the workspace
 * is not empty, so sample totals can never be confused with real records.
 */
export async function loadSampleWorkspace(db: ClinicalTrackerDB = getDB()): Promise<void> {
  if (!(await canLoadSampleWorkspace(db))) {
    const state = await getSampleState(db);
    throw new ServiceError(
      'conflict',
      state.active
        ? 'Sample data is already loaded.'
        : 'Sample data can only be added to an empty workspace. Back up and erase your current records first.',
    );
  }

  const today = todayIso();
  let categories = (await db.categories.toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
  const built = buildSampleRecords(categories, today);

  // A profile with no categories would leave the sample unclassified; seed the
  // missing defaults as sample-scoped rows so removal stays exact.
  const extraCategories: Category[] = [];
  if (built.missingKind) {
    const defaults: Array<{ kind: Category['kind']; label: string; sortOrder: number }> = [
      { kind: 'direct', label: 'Direct client work', sortOrder: 10 },
      { kind: 'indirect', label: 'Indirect work', sortOrder: 20 },
      { kind: 'individual_supervision', label: 'Individual supervision', sortOrder: 30 },
      { kind: 'group_supervision', label: 'Group supervision', sortOrder: 40 },
      { kind: 'other', label: 'Other professional activity', sortOrder: 50 },
    ];
    for (const d of defaults) {
      if (categories.some((c) => c.kind === d.kind)) continue;
      const ts = nowIso();
      extraCategories.push({
        id: `${SAMPLE_ID_PREFIX}cat-${d.kind}`,
        label: d.label,
        kind: d.kind,
        active: true,
        sortOrder: d.sortOrder,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    categories = [...categories, ...extraCategories];
    const rebuilt = buildSampleRecords(categories, today);
    Object.assign(built, rebuilt);
  }

  // Full validation before the transaction: either every record is written, or nothing is.
  const activities = built.activities.map((a) => validateRecord<Activity>(activitySchema, a, 'activity'));
  const requirements = built.requirements.map((r) => validateRecord<Requirement>(requirementSchema, r, 'target'));
  const renewalPeriods = built.renewalPeriods.map((p) => validateRecord<RenewalPeriod>(renewalPeriodSchema, p, 'renewal period'));
  const ceus = built.ceus.map((c) => validateRecord<CeURecord>(ceuSchema, c, 'CEU record'));
  extraCategories.forEach((c) => validateRecord<Category>(categorySchema, c, 'category'));

  const current = await settingsRepository.get<Record<string, unknown>>('app', {}, db);
  const nextSettings = validateRecord<AppSettings>(
    settingsSchema,
    {
      onboarded: true,
      displayName: (current.displayName as string | undefined) || SAMPLE_DISPLAY_NAME,
      profession: (current.profession as string | undefined) || SAMPLE_PROFESSION,
      includeSupervisionInClinicalTotal: Boolean(current.includeSupervisionInClinicalTotal),
    },
    'settings',
  );

  const state: SampleState = { active: true, loadedAt: nowIso() };

  try {
    await db.transaction(
      'rw',
      [db.activities, db.categories, db.requirements, db.renewalPeriods, db.ceus, db.settings, db.meta],
      async () => {
        if (extraCategories.length > 0) await db.categories.bulkPut(extraCategories);
        await db.activities.bulkPut(activities);
        await db.requirements.bulkPut(requirements);
        await db.renewalPeriods.bulkPut(renewalPeriods);
        await db.ceus.bulkPut(ceus);
        await db.settings.put({ key: 'app', value: nextSettings });
        await db.meta.put({ key: SAMPLE_META_KEY, value: state });
      },
    );
  } catch {
    throw new ServiceError('storage', 'We could not load the sample workspace. Nothing was changed.');
  }
}

export interface RemoveSampleResult {
  activities: number;
  ceus: number;
  requirements: number;
  renewalPeriods: number;
}

/**
 * Deletes only rows whose id starts with `sample-`. Records the user added
 * themselves are always kept, even if the sample workspace is still loaded.
 */
export async function removeSampleWorkspace(db: ClinicalTrackerDB = getDB()): Promise<RemoveSampleResult> {
  const isSample = (row: { id: string }) => row.id.startsWith(SAMPLE_ID_PREFIX);

  try {
    return await db.transaction(
      'rw',
      [db.activities, db.categories, db.requirements, db.renewalPeriods, db.ceus, db.settings, db.meta],
      async () => {
        const [activities, categories, requirements, periods, ceus] = await Promise.all([
          db.activities.toArray(),
          db.categories.toArray(),
          db.requirements.toArray(),
          db.renewalPeriods.toArray(),
          db.ceus.toArray(),
        ]);

        const sampleActivities = activities.filter(isSample).map((r) => r.id);
        const sampleCategories = categories.filter(isSample).map((r) => r.id);
        const sampleRequirements = requirements.filter(isSample).map((r) => r.id);
        const samplePeriods = periods.filter(isSample).map((r) => r.id);
        const sampleCeus = ceus.filter(isSample).map((r) => r.id);

        await Promise.all([
          sampleActivities.length > 0 ? db.activities.bulkDelete(sampleActivities) : Promise.resolve(),
          sampleCategories.length > 0 ? db.categories.bulkDelete(sampleCategories) : Promise.resolve(),
          sampleRequirements.length > 0 ? db.requirements.bulkDelete(sampleRequirements) : Promise.resolve(),
          samplePeriods.length > 0 ? db.renewalPeriods.bulkDelete(samplePeriods) : Promise.resolve(),
          sampleCeus.length > 0 ? db.ceus.bulkDelete(sampleCeus) : Promise.resolve(),
        ]);

        // Reset only the profile fields that the sample supplied, so a name the
        // user typed themselves is never removed.
        const current = await settingsRepository.get<Record<string, unknown>>('app', {}, db);
        const next = { ...current };
        if (next.displayName === SAMPLE_DISPLAY_NAME) next.displayName = '';
        if (next.profession === SAMPLE_PROFESSION) next.profession = '';
        const parsed = settingsSchema.safeParse({
          onboarded: true,
          displayName: next.displayName ?? '',
          profession: next.profession ?? '',
          includeSupervisionInClinicalTotal: Boolean(next.includeSupervisionInClinicalTotal),
        });
        if (parsed.success) await db.settings.put({ key: 'app', value: parsed.data });

        await db.meta.delete(SAMPLE_META_KEY);

        return {
          activities: sampleActivities.length,
          ceus: sampleCeus.length,
          requirements: sampleRequirements.length,
          renewalPeriods: samplePeriods.length,
        };
      },
    );
  } catch {
    throw new ServiceError('storage', 'We could not remove the sample data. Nothing was changed.');
  }
}

/** A stable id helper for sample-scoped records (kept for tests and future rows). */
export function sampleId(suffix: string): string {
  return `${SAMPLE_ID_PREFIX}${suffix || newId()}`;
}
