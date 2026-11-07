/**
 * Catalog services — categories, requirements (targets) and renewal periods.
 */
import type { z } from 'zod';
import { categoryRepository, renewalPeriodRepository, requirementRepository, type Db } from '@/repositories';
import { categorySchema, renewalPeriodSchema, requirementSchema } from '@/validation/schemas';
import type { Requirement } from '@/domain/types';
import { nowIso } from '@/domain/date';
import { newId } from '@/lib/id';
import { firstIssueMessage, ServiceError } from './errors';

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ServiceError('validation', firstIssueMessage(result.error));
  }
  return result.data;
}

/* ------------------------------ Categories ---------------------------- */

export async function listCategories(db?: Db) {
  const all = await categoryRepository.list(db);
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveCategory(
  input: { id?: string; label: string; kind: string; active?: boolean; sortOrder?: number },
  db?: Db,
): Promise<string> {
  const existing = input.id ? await categoryRepository.getById(input.id, db) : undefined;
  const ts = nowIso();
  const record = parseOrThrow(categorySchema, {
    id: input.id || existing?.id || newId(),
    label: input.label,
    kind: input.kind,
    active: input.active ?? existing?.active ?? true,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? (await categoryRepository.count(db)) * 10 + 10,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  });
  await categoryRepository.put(record, db);
  return record.id;
}

/**
 * Deactivates a category instead of deleting it, so historical activities
 * keep their classification. Deactivated categories are hidden from forms.
 */
export async function deactivateCategory(id: string, db?: Db): Promise<void> {
  const existing = await categoryRepository.getById(id, db);
  if (!existing) throw new ServiceError('not_found', 'This category could not be found.');
  await categoryRepository.put({ ...existing, active: false, updatedAt: nowIso() }, db);
}

export async function reactivateCategory(id: string, db?: Db): Promise<void> {
  const existing = await categoryRepository.getById(id, db);
  if (!existing) throw new ServiceError('not_found', 'This category could not be found.');
  await categoryRepository.put({ ...existing, active: true, updatedAt: nowIso() }, db);
}

/* ----------------------------- Requirements --------------------------- */

export async function listRequirements(db?: Db) {
  const all = await requirementRepository.list(db);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface RequirementDraft {
  id?: string;
  label: string;
  kind: Requirement['kind'];
  categoryId?: string | null;
  targetMinutes: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  active?: boolean;
}

export async function saveRequirement(input: RequirementDraft, db?: Db): Promise<string> {
  const existing = input.id ? await requirementRepository.getById(input.id, db) : undefined;
  const ts = nowIso();
  const parsed = parseOrThrow(requirementSchema, {
    id: input.id || existing?.id || newId(),
    label: input.label,
    kind: input.kind,
    categoryId: input.kind === 'custom_category' ? (input.categoryId ?? null) : null,
    targetMinutes: input.targetMinutes,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  });
  const record: Requirement = {
    ...parsed,
    categoryId: parsed.categoryId ?? null,
    periodStart: parsed.periodStart ?? null,
    periodEnd: parsed.periodEnd ?? null,
  };
  await requirementRepository.put(record, db);
  return record.id;
}

export async function deleteRequirement(id: string, db?: Db): Promise<void> {
  const existing = await requirementRepository.getById(id, db);
  if (!existing) throw new ServiceError('not_found', 'This target could not be found.');
  await requirementRepository.remove(id, db);
}

/* --------------------------- Renewal periods -------------------------- */

export async function listRenewalPeriods(db?: Db) {
  const all = await renewalPeriodRepository.list(db);
  return all.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function saveRenewalPeriod(
  input: {
    id?: string;
    label: string;
    startDate: string;
    endDate: string;
    targetCredits: number;
    active?: boolean;
  },
  db?: Db,
): Promise<string> {
  const existing = input.id ? await renewalPeriodRepository.getById(input.id, db) : undefined;
  const ts = nowIso();
  const record = parseOrThrow(renewalPeriodSchema, {
    id: input.id || existing?.id || newId(),
    label: input.label,
    startDate: input.startDate,
    endDate: input.endDate,
    targetCredits: input.targetCredits,
    active: input.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  });
  await renewalPeriodRepository.put(record, db);
  return record.id;
}

export async function deleteRenewalPeriod(id: string, db?: Db): Promise<void> {
  const existing = await renewalPeriodRepository.getById(id, db);
  if (!existing) throw new ServiceError('not_found', 'This period could not be found.');
  await renewalPeriodRepository.remove(id, db);
}
