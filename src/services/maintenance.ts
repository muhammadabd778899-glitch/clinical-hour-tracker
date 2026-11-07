/** Maintenance operations (Settings page): erase local data safely. */
import { getDB, initDatabase, type ClinicalTrackerDB } from '@/db/database';
import { ServiceError } from './errors';

/**
 * Erases every record on this device inside one transaction, then re-seeds
 * the default categories and returns the app to first-run onboarding.
 */
export async function eraseAllData(db: ClinicalTrackerDB = getDB()): Promise<void> {
  try {
    await db.transaction(
      'rw',
      [db.activities, db.categories, db.requirements, db.renewalPeriods, db.ceus, db.settings, db.meta],
      async () => {
        await Promise.all([
          db.activities.clear(),
          db.categories.clear(),
          db.requirements.clear(),
          db.renewalPeriods.clear(),
          db.ceus.clear(),
          db.settings.clear(),
          db.meta.clear(),
        ]);
      },
    );
    await initDatabase(db);
  } catch {
    throw new ServiceError('storage', 'We could not erase the data. Nothing was changed.');
  }
}
