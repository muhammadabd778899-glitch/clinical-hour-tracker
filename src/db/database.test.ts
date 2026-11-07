import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ClinicalTrackerDB, defaultCategories, initDatabase, isStorageAvailable, setDB } from './database';
import { SCHEMA_V1 } from './schema';
import { activityRepository, categoryRepository, settingsRepository } from '@/repositories';
import { createActivity, updateActivity, deleteActivity } from '@/services/activity';
import { nowIso } from '@/domain/date';

let db: ClinicalTrackerDB;

beforeEach(async () => {
  db = new ClinicalTrackerDB(`test-db-${crypto.randomUUID()}`);
  await initDatabase(db);
  setDB(db);
});

describe('database creation', () => {
  it('opens and seeds the default categories exactly once', async () => {
    const categories = await categoryRepository.list(db);
    expect(categories).toHaveLength(5);
    expect(categories.map((c) => c.kind)).toEqual(
      expect.arrayContaining(['direct', 'indirect', 'individual_supervision', 'group_supervision', 'other']),
    );

    // Re-initialising must not duplicate the defaults.
    await initDatabase(db);
    expect(await categoryRepository.count(db)).toBe(5);
  });

  it('checks storage availability', async () => {
    expect(await isStorageAvailable()).toBe(true);
  });
});

describe('CRUD', () => {
  it('creates, reads, updates and deletes an activity', async () => {
    const categories = await categoryRepository.list(db);
    const direct = categories.find((c) => c.kind === 'direct')!;

    const id = await createActivity(
      {
        type: 'clinical',
        categoryId: direct.id,
        title: 'Intake session',
        date: '2026-03-05',
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        location: 'Campus clinic',
        notes: null,
      },
      db,
    );

    const created = await activityRepository.getById(id, db);
    expect(created?.title).toBe('Intake session');
    expect(created?.durationMinutes).toBe(60);

    await updateActivity(id, { title: 'Intake session (updated)', endTime: '10:30', durationMinutes: 90 }, db);
    const updated = await activityRepository.getById(id, db);
    expect(updated?.title).toBe('Intake session (updated)');
    expect(updated?.durationMinutes).toBe(90);
    expect(updated?.id).toBe(id); // id preserved

    await deleteActivity(id, db);
    expect(await activityRepository.getById(id, db)).toBeUndefined();
    expect(await activityRepository.count(db)).toBe(0);
  });

  it('rejects invalid records before they reach the database', async () => {
    await expect(
      createActivity(
        {
          type: 'clinical',
          categoryId: null,
          title: '',
          date: '2026-03-05',
          startTime: null,
          endTime: null,
          durationMinutes: 0,
          location: null,
          notes: null,
        },
        db,
      ),
    ).rejects.toThrow('Give this activity a short title');

    expect(await activityRepository.count(db)).toBe(0);
  });

  it('rejects a duration that disagrees with start/end times', async () => {
    await expect(
      createActivity(
        {
          type: 'clinical',
          categoryId: null,
          title: 'Mismatch',
          date: '2026-03-05',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 30,
          location: null,
          notes: null,
        },
        db,
      ),
    ).rejects.toThrow('does not match');
  });

  it('reports a friendly error when updating a missing record', async () => {
    await expect(updateActivity('does-not-exist', { title: 'x' }, db)).rejects.toThrow(
      'This activity could not be found.',
    );
    await expect(deleteActivity('does-not-exist', db)).rejects.toThrow('This activity could not be found.');
  });

  it('keeps a single row per id (ids are unique)', async () => {
    const categories = await categoryRepository.list(db);
    const direct = categories.find((c) => c.kind === 'direct')!;
    const values = {
      type: 'clinical' as const,
      categoryId: direct.id,
      title: 'Same id twice',
      date: '2026-03-05',
      startTime: null,
      endTime: null,
      durationMinutes: 60,
      location: null,
      notes: null,
    };
    const id = await createActivity(values, db);
    await activityRepository.put(
      {
        ...values,
        id,
        startTime: null,
        endTime: null,
        location: null,
        notes: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      db,
    );
    expect(await activityRepository.count(db)).toBe(1);
  });
});

describe('persistence', () => {
  it('keeps records after closing and reopening the database', async () => {
    const categories = await categoryRepository.list(db);
    const id = await createActivity(
      {
        type: 'clinical',
        categoryId: categories.find((c) => c.kind === 'direct')!.id,
        title: 'Persisted',
        date: '2026-03-05',
        startTime: null,
        endTime: null,
        durationMinutes: 45,
        location: null,
        notes: null,
      },
      db,
    );

    db.close();

    const reopened = new ClinicalTrackerDB(db.name);
    await initDatabase(reopened);
    const record = await activityRepository.getById(id, reopened);
    expect(record?.title).toBe('Persisted');
    reopened.close();
  });

  it('persists settings as key/value rows', async () => {
    await settingsRepository.set('app', { onboarded: true, displayName: 'Alex' }, db);
    expect(await settingsRepository.get('app', { onboarded: false }, db)).toEqual({
      onboarded: true,
      displayName: 'Alex',
    });
  });
});

describe('migrations', () => {
  it('upgrades a v1 database to v2 without losing rows', async () => {
    const name = `legacy-db-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores(SCHEMA_V1);
    await legacy.open();
    await legacy.table('ceus').add({
      id: 'ceu-1',
      title: 'Legacy course',
      provider: 'Provider',
      completionDate: '2025-06-01',
      credits: 4,
      category: 'Ethics',
      renewalPeriodId: 'period-1',
      certificateRef: null,
      notes: null,
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
    });
    legacy.close();

    const upgraded = new ClinicalTrackerDB(name);
    await upgraded.open();
    expect(await upgraded.ceus.count()).toBe(1);
    // v2 added the renewalPeriodId index — querying through it must work.
    const byPeriod = await upgraded.ceus.where('renewalPeriodId').equals('period-1').toArray();
    expect(byPeriod).toHaveLength(1);
    expect(byPeriod[0]?.title).toBe('Legacy course');
    upgraded.close();

    await Dexie.delete(name);
  });

  it('reports the latest schema version in meta', async () => {
    expect(await db.meta.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: 2 });
  });
});

describe('transactions', () => {
  it('rolls back every write when a transaction fails', async () => {
    const before = await activityRepository.count(db);
    const categories = await categoryRepository.list(db);
    const direct = categories.find((c) => c.kind === 'direct')!;

    await expect(
      db.transaction('rw', [db.activities, db.settings], async () => {
        await activityRepository.put(
          {
            id: 'tx-1',
            type: 'clinical',
            categoryId: direct.id,
            title: 'Will be rolled back',
            date: '2026-03-05',
            startTime: null,
            endTime: null,
            durationMinutes: 30,
            location: null,
            notes: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          db,
        );
        await settingsRepository.set('rollback-marker', true, db);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await activityRepository.count(db)).toBe(before);
    expect(await activityRepository.getById('tx-1', db)).toBeUndefined();
    expect(await settingsRepository.get('rollback-marker', false, db)).toBe(false);
  });

  it('defaultCategories produces unique ids', () => {
    const first = defaultCategories();
    const second = defaultCategories();
    const ids = new Set([...first, ...second].map((c) => c.id));
    expect(ids.size).toBe(first.length + second.length);
  });
});
