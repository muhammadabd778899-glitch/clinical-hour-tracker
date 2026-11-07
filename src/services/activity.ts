/**
 * Activity service — create / update / delete clinical, supervision and
 * other professional activities with validation before every write.
 */
import type { z } from 'zod';
import { activityRepository, type Db } from '@/repositories';
import { activitySchema, type ActivityFormValues } from '@/validation/schemas';
import { nowIso, todayIso } from '@/domain/date';
import { newId } from '@/lib/id';
import { firstIssueMessage, ServiceError } from './errors';

function validate(input: z.input<typeof activitySchema>): z.output<typeof activitySchema> {
  const result = activitySchema.safeParse(input);
  if (!result.success) {
    throw new ServiceError('validation', firstIssueMessage(result.error));
  }
  return result.data;
}

/** Creates a new activity from form values (id and timestamps are assigned here). */
export async function createActivity(input: ActivityFormValues, db?: Db): Promise<string> {
  const id = newId();
  const ts = nowIso();
  const record = validate({ ...input, id, createdAt: ts, updatedAt: ts });
  try {
    await activityRepository.put(
      {
        ...record,
        startTime: record.startTime ?? null,
        endTime: record.endTime ?? null,
        location: record.location ?? null,
        notes: record.notes ?? null,
      },
      db,
    );
  } catch {
    throw new ServiceError('storage', 'We could not save this activity. Please try again.');
  }
  return id;
}

/** Generates a draft activity object for forms (never persisted). */
export function draftActivity(overrides: Partial<ActivityFormValues> = {}): ActivityFormValues {
  return {
    type: 'clinical',
    categoryId: null,
    title: '',
    // New entries default to today; the user can change it before saving.
    date: todayIso(),
    startTime: null,
    endTime: null,
    durationMinutes: 0,
    location: null,
    notes: null,
    ...overrides,
  };
}

/**
 * Updates an existing activity.
 * The record id is preserved; the record is re-validated as a whole.
 */
export async function updateActivity(
  id: string,
  patch: Partial<ActivityFormValues>,
  db?: Db,
): Promise<void> {
  const existing = await activityRepository.getById(id, db);
  if (!existing) {
    throw new ServiceError('not_found', 'This activity could not be found.');
  }
  const merged = validate({ ...existing, ...patch, id: existing.id, updatedAt: nowIso() });
  try {
    await activityRepository.put(
      {
        ...merged,
        startTime: merged.startTime ?? null,
        endTime: merged.endTime ?? null,
        location: merged.location ?? null,
        notes: merged.notes ?? null,
      },
      db,
    );
  } catch {
    throw new ServiceError('storage', 'We could not save your changes. Please try again.');
  }
}

export async function deleteActivity(id: string, db?: Db): Promise<void> {
  const existing = await activityRepository.getById(id, db);
  if (!existing) {
    throw new ServiceError('not_found', 'This activity could not be found.');
  }
  try {
    await activityRepository.remove(id, db);
  } catch {
    throw new ServiceError('storage', 'We could not delete this activity. Please try again.');
  }
}

export async function getActivity(id: string, db?: Db) {
  return activityRepository.getById(id, db);
}
