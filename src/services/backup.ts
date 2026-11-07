/**
 * Backup & restore — versioned JSON format, full validation before any write,
 * and a single transaction so a failed restore can never corrupt existing data.
 */
import { z } from 'zod';
import { getDB, defaultCategories, type ClinicalTrackerDB } from '@/db/database';
import { LATEST_SCHEMA_VERSION } from '@/db/schema';
import {
  activitySchema,
  categorySchema,
  ceuSchema,
  renewalPeriodSchema,
  requirementSchema,
} from '@/validation/schemas';
import type { Activity, CeURecord, Requirement } from '@/domain/types';
import { nowIso } from '@/domain/date';
import { ServiceError } from './errors';

export const BACKUP_FORMAT = 'clinical-hour-tracker-backup';
export const BACKUP_VERSION = 1;

const rowSchema = z.object({ key: z.string(), value: z.unknown() });

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  schemaVersion: z.number(),
  data: z.object({
    activities: z.array(activitySchema),
    categories: z.array(categorySchema),
    requirements: z.array(requirementSchema),
    renewalPeriods: z.array(renewalPeriodSchema),
    ceus: z.array(ceuSchema),
    settings: z.array(rowSchema),
    meta: z.array(rowSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; message: string };

/** Builds a full backup of the local database. */
export async function createBackup(db: ClinicalTrackerDB = getDB()): Promise<Backup> {
  const [activities, categories, requirements, renewalPeriods, ceus, settings, meta] = await Promise.all([
    db.activities.toArray(),
    db.categories.toArray(),
    db.requirements.toArray(),
    db.renewalPeriods.toArray(),
    db.ceus.toArray(),
    db.settings.toArray(),
    db.meta.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    schemaVersion: LATEST_SCHEMA_VERSION,
    data: {
      activities,
      categories,
      requirements,
      renewalPeriods,
      ceus,
      settings,
      meta,
    },
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** Validates untrusted text. Never throws; returns a friendly failure reason. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'This file could not be read as JSON. Choose a backup file created by this app.' };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'This file is not a valid backup.' };
  }
  const candidate = raw as Record<string, unknown>;
  if (candidate.format !== BACKUP_FORMAT) {
    return { ok: false, message: 'This file was not created by All in One Clinical Tracker.' };
  }
  if (candidate.version !== BACKUP_VERSION) {
    return {
      ok: false,
      message: `This backup uses format version ${String(candidate.version)}, but this app reads version ${BACKUP_VERSION}. Update the app before restoring.`,
    };
  }
  const result = backupSchema.safeParse(candidate);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join('.') || 'the backup contents';
    return {
      ok: false,
      message: `The backup failed validation (${where}): ${first?.message ?? 'unexpected content'}. Your existing data was not changed.`,
    };
  }
  return { ok: true, backup: result.data };
}

export interface RestorePreview {
  counts: {
    activities: number;
    categories: number;
    requirements: number;
    renewalPeriods: number;
    ceus: number;
    settings: number;
  };
  /** Ids already present locally (these are overwritten in merge mode). */
  overlappingIds: number;
  exportedAt: string;
}

/** Shows what a restore would change before anything is written. */
export async function previewRestore(
  backup: Backup,
  db: ClinicalTrackerDB = getDB(),
): Promise<RestorePreview> {
  const [activities, categories, requirements, renewalPeriods, ceus] = await Promise.all([
    db.activities.toArray(),
    db.categories.toArray(),
    db.requirements.toArray(),
    db.renewalPeriods.toArray(),
    db.ceus.toArray(),
  ]);
  const existingIds = new Set([
    ...activities.map((a) => a.id),
    ...categories.map((c) => c.id),
    ...requirements.map((r) => r.id),
    ...renewalPeriods.map((r) => r.id),
    ...ceus.map((c) => c.id),
  ]);
  const incomingIds = [
    ...backup.data.activities.map((a) => a.id),
    ...backup.data.categories.map((c) => c.id),
    ...backup.data.requirements.map((r) => r.id),
    ...backup.data.renewalPeriods.map((r) => r.id),
    ...backup.data.ceus.map((c) => c.id),
  ];
  const overlapping = incomingIds.filter((id) => existingIds.has(id)).length;
  return {
    counts: {
      activities: backup.data.activities.length,
      categories: backup.data.categories.length,
      requirements: backup.data.requirements.length,
      renewalPeriods: backup.data.renewalPeriods.length,
      ceus: backup.data.ceus.length,
      settings: backup.data.settings.length,
    },
    overlappingIds: overlapping,
    exportedAt: backup.exportedAt,
  };
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  mode: RestoreMode;
  written: {
    activities: number;
    categories: number;
    requirements: number;
    renewalPeriods: number;
    ceus: number;
  };
}

function normalizeActivity(a: z.output<typeof activitySchema>): Activity {
  return {
    ...a,
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    location: a.location ?? null,
    notes: a.notes ?? null,
  };
}

function normalizeRequirement(r: z.output<typeof requirementSchema>): Requirement {
  return {
    ...r,
    categoryId: r.categoryId ?? null,
    periodStart: r.periodStart ?? null,
    periodEnd: r.periodEnd ?? null,
  };
}

function normalizeCeu(c: z.output<typeof ceuSchema>): CeURecord {
  return {
    ...c,
    renewalPeriodId: c.renewalPeriodId ?? null,
    certificateRef: c.certificateRef ?? null,
    notes: c.notes ?? null,
  };
}

/**
 * Applies a validated backup.
 * - `replace`: clears existing records first, then writes the backup.
 * - `merge`: upserts by id, keeping local records the backup does not contain.
 * Everything runs inside one transaction: any failure rolls back completely.
 */
export async function restoreBackup(
  backup: Backup,
  mode: RestoreMode,
  db: ClinicalTrackerDB = getDB(),
): Promise<RestoreResult> {
  const data = backup.data;
  // Validate the whole payload again inside the transaction so nothing is
  // written when a single record is invalid.
  const checks = [
    ...data.activities.map((a) => activitySchema.safeParse(a)),
    ...data.categories.map((c) => categorySchema.safeParse(c)),
    ...data.requirements.map((r) => requirementSchema.safeParse(r)),
    ...data.renewalPeriods.map((r) => renewalPeriodSchema.safeParse(r)),
    ...data.ceus.map((c) => ceuSchema.safeParse(c)),
  ];
  const failed = checks.find((c) => !c.success);
  if (failed && !failed.success) {
    throw new ServiceError('validation', 'The backup contains an invalid record. Your existing data was not changed.');
  }

  try {
    const result = await db.transaction(
      'rw',
      [db.activities, db.categories, db.requirements, db.renewalPeriods, db.ceus, db.settings, db.meta],
      async () => {
        if (mode === 'replace') {
          await Promise.all([
            db.activities.clear(),
            db.categories.clear(),
            db.requirements.clear(),
            db.renewalPeriods.clear(),
            db.ceus.clear(),
            db.settings.clear(),
          ]);
        }

        await db.activities.bulkPut(data.activities.map(normalizeActivity));
        await db.categories.bulkPut(data.categories);
        await db.requirements.bulkPut(data.requirements.map(normalizeRequirement));
        await db.renewalPeriods.bulkPut(data.renewalPeriods);
        await db.ceus.bulkPut(data.ceus.map(normalizeCeu));

        for (const row of data.settings) await db.settings.put({ key: row.key, value: row.value });
        for (const row of data.meta) await db.meta.put({ key: row.key, value: row.value });

        // A replaced profile with no categories would leave everything
        // unclassified — re-seed the defaults in that case.
        if (mode === 'replace' && data.categories.length === 0) {
          await db.categories.bulkPut(defaultCategories());
        }

        await db.meta.put({ key: 'schemaVersion', value: LATEST_SCHEMA_VERSION });
        await db.meta.put({ key: 'lastRestoreAt', value: nowIso() });

        return {
          mode,
          written: {
            activities: data.activities.length,
            categories: data.categories.length,
            requirements: data.requirements.length,
            renewalPeriods: data.renewalPeriods.length,
            ceus: data.ceus.length,
          },
        } satisfies RestoreResult;
      },
    );
    return result;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      'storage',
      'The restore did not complete, so nothing was changed. Your existing data is still safe.',
    );
  }
}
