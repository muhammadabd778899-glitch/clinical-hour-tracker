/** Settings service — typed access to the key/value settings table. */
import { settingsRepository, type Db } from '@/repositories';
import { settingsSchema } from '@/validation/schemas';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { firstIssueMessage, ServiceError } from './errors';

export type { AppSettings } from '@/domain/types';
export { DEFAULT_SETTINGS } from '@/domain/types';

export async function getSettings(db?: Db): Promise<typeof DEFAULT_SETTINGS> {
  const stored = await settingsRepository.get<Partial<typeof DEFAULT_SETTINGS>>('app', {}, db);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(
  patch: Partial<typeof DEFAULT_SETTINGS>,
  db?: Db,
): Promise<typeof DEFAULT_SETTINGS> {
  const current = await getSettings(db);
  const merged = { ...current, ...patch };
  const result = settingsSchema.safeParse(merged);
  if (!result.success) {
    throw new ServiceError('validation', firstIssueMessage(result.error));
  }
  await settingsRepository.set('app', result.data, db);
  return result.data;
}
