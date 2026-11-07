/** CEU services — validated writes, strictly separate from clinical hours. */
import { ceuRepository, type Db } from '@/repositories';
import { ceuSchema } from '@/validation/schemas';
import type { CeURecord } from '@/domain/types';
import { nowIso } from '@/domain/date';
import { newId } from '@/lib/id';
import { firstIssueMessage, ServiceError } from './errors';

export async function listCeus(db?: Db) {
  const all = await ceuRepository.list(db);
  return all.sort((a, b) => b.completionDate.localeCompare(a.completionDate));
}

export async function saveCeu(
  input: {
    id?: string;
    title: string;
    provider: string;
    completionDate: string;
    credits: number;
    category: string;
    renewalPeriodId?: string | null;
    certificateRef?: string | null;
    notes?: string | null;
  },
  db?: Db,
): Promise<string> {
  const existing = input.id ? await ceuRepository.getById(input.id, db) : undefined;
  const ts = nowIso();
  const result = ceuSchema.safeParse({
    id: input.id || existing?.id || newId(),
    title: input.title,
    provider: input.provider,
    completionDate: input.completionDate,
    credits: input.credits,
    category: input.category,
    renewalPeriodId: input.renewalPeriodId ?? null,
    certificateRef: input.certificateRef ?? null,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  });
  if (!result.success) {
    throw new ServiceError('validation', firstIssueMessage(result.error));
  }
  const record: CeURecord = {
    ...result.data,
    renewalPeriodId: result.data.renewalPeriodId ?? null,
    certificateRef: result.data.certificateRef ?? null,
    notes: result.data.notes ?? null,
  };
  await ceuRepository.put(record, db);
  return record.id;
}

export async function deleteCeu(id: string, db?: Db): Promise<void> {
  const existing = await ceuRepository.getById(id, db);
  if (!existing) throw new ServiceError('not_found', 'This CEU record could not be found.');
  await ceuRepository.remove(id, db);
}
