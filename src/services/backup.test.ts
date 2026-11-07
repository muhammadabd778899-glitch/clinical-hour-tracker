import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createBackup,
  parseBackup,
  previewRestore,
  restoreBackup,
  serializeBackup,
  type Backup,
} from './backup';
import { ClinicalTrackerDB, initDatabase, setDB } from '@/db/database';
import { activityRepository, categoryRepository, ceuRepository, settingsRepository } from '@/repositories';
import { createActivity } from '@/services/activity';
import { nowIso } from '@/domain/date';

let db: ClinicalTrackerDB;

async function seed(): Promise<string> {
  const categories = await categoryRepository.list(db);
  return createActivity(
    {
      type: 'clinical',
      categoryId: categories.find((c) => c.kind === 'direct')!.id,
      title: 'Seeded activity',
      date: '2026-03-05',
      startTime: null,
      endTime: null,
      durationMinutes: 90,
      location: null,
      notes: null,
    },
    db,
  );
}

beforeEach(async () => {
  db = new ClinicalTrackerDB(`backup-db-${crypto.randomUUID()}`);
  await initDatabase(db);
  setDB(db);
});

describe('createBackup / parseBackup', () => {
  it('round-trips through JSON', async () => {
    await seed();
    const backup = await createBackup(db);
    const parsed = parseBackup(serializeBackup(backup));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.data.activities).toHaveLength(1);
      expect(parsed.backup.data.activities[0]?.title).toBe('Seeded activity');
      expect(parsed.backup.data.categories.length).toBeGreaterThan(0);
      expect(parsed.backup.format).toBe(BACKUP_FORMAT);
      expect(parsed.backup.version).toBe(BACKUP_VERSION);
    }
  });

  it('rejects text that is not JSON', () => {
    const result = parseBackup('definitely not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('could not be read as JSON');
  });

  it('rejects files from other apps', () => {
    const result = parseBackup(JSON.stringify({ format: 'some-other-app', version: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('not created by All in One Clinical Tracker');
  });

  it('rejects backups from a different format version', () => {
    const result = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 99, exportedAt: '', schemaVersion: 2, data: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('version 99');
  });

  it('rejects a structurally invalid backup and explains where', async () => {
    await seed();
    const backup = await createBackup(db);
    const tampered = {
      ...backup,
      data: { ...backup.data, activities: [{ ...backup.data.activities[0]!, durationMinutes: -10 }] },
    };

    const result = parseBackup(JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('failed validation');
  });
});

describe('previewRestore', () => {
  it('counts records and reports overlapping ids', async () => {
    const id = await seed();
    const backup = await createBackup(db);
    const preview = await previewRestore(backup, db);

    expect(preview.counts.activities).toBe(1);
    // 1 activity + 5 default categories already exist locally with the same ids.
    expect(preview.overlappingIds).toBe(6);
    expect(preview.exportedAt).toBe(backup.exportedAt);
    void id;
  });
});

describe('restoreBackup', () => {
  it('replaces local data with the backup contents', async () => {
    await seed();
    const backup = await createBackup(db);

    // Local-only record that must disappear after a replace restore.
    await createActivity(
      {
        type: 'clinical',
        categoryId: null,
        title: 'Local only',
        date: '2026-03-06',
        startTime: null,
        endTime: null,
        durationMinutes: 30,
        location: null,
        notes: null,
      },
      db,
    );
    expect(await activityRepository.count(db)).toBe(2);

    const result = await restoreBackup(backup, 'replace', db);
    expect(result.written.activities).toBe(1);

    const titles = (await activityRepository.list(db)).map((a) => a.title);
    expect(titles).toEqual(['Seeded activity']);
    // Default categories are preserved for a profile that has none in the backup.
    expect((await categoryRepository.list(db)).length).toBeGreaterThan(0);
  });

  it('merges without deleting local records', async () => {
    await seed();
    const backup = await createBackup(db);

    const localId = await createActivity(
      {
        type: 'clinical',
        categoryId: null,
        title: 'Local only',
        date: '2026-03-06',
        startTime: null,
        endTime: null,
        durationMinutes: 30,
        location: null,
        notes: null,
      },
      db,
    );

    await restoreBackup(backup, 'merge', db);

    const titles = (await activityRepository.list(db)).map((a) => a.title);
    expect(titles).toContain('Seeded activity');
    expect(titles).toContain('Local only');
    expect(await activityRepository.getById(localId, db)).toBeDefined();
  });

  it('updates a record with the same id from the backup (merge)', async () => {
    const id = await seed();
    const backup = await createBackup(db);
    const modified: Backup = {
      ...backup,
      data: {
        ...backup.data,
        activities: backup.data.activities.map((a) => ({ ...a, title: 'From backup' })),
      },
    };

    await restoreBackup(modified, 'merge', db);
    expect((await activityRepository.getById(id, db))?.title).toBe('From backup');
    expect(await activityRepository.count(db)).toBe(1);
  });

  it('rejects an invalid backup without touching existing data', async () => {
    await seed();
    const backup = await createBackup(db);
    const invalid: Backup = {
      ...backup,
      data: {
        ...backup.data,
        activities: backup.data.activities.map((a) => ({ ...a, durationMinutes: -999 })),
      },
    };

    await expect(restoreBackup(invalid, 'replace', db)).rejects.toThrow('invalid record');
    expect(await activityRepository.count(db)).toBe(1);
    expect((await activityRepository.list(db))[0]?.title).toBe('Seeded activity');
  });

  it('rolls back a failed replace restore so nothing is lost', async () => {
    await seed();
    const backup = await createBackup(db);

    const spy = vi.spyOn(db.activities, 'bulkPut').mockRejectedValueOnce(new Error('disk error'));

    await expect(restoreBackup(backup, 'replace', db)).rejects.toThrow('existing data is still safe');
    spy.mockRestore();

    // The clear() inside the transaction must have been rolled back too.
    expect(await activityRepository.count(db)).toBe(1);
    expect((await activityRepository.list(db))[0]?.title).toBe('Seeded activity');
    expect((await categoryRepository.list(db)).length).toBe(5);
  });

  it('preserves settings through a replace restore', async () => {
    await settingsRepository.set('app', { onboarded: true, displayName: 'Sam' }, db);
    const backup = await createBackup(db);
    await settingsRepository.set('app', { onboarded: true, displayName: 'Changed' }, db);

    await restoreBackup(backup, 'replace', db);
    expect(await settingsRepository.get('app', { displayName: '' }, db)).toMatchObject({ displayName: 'Sam' });
  });

  it('keeps CEU records out of activity tables', async () => {
    await seed();
    const backup = await createBackup(db);
    await ceuRepository.put(
      {
        id: 'ceu-1',
        title: 'Course',
        provider: 'Provider',
        completionDate: '2026-03-01',
        credits: 3,
        category: 'Ethics',
        renewalPeriodId: null,
        certificateRef: null,
        notes: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      db,
    );

    await restoreBackup(backup, 'replace', db);
    expect(await ceuRepository.count(db)).toBe(0); // not part of the backup
    expect(await activityRepository.count(db)).toBe(1);
  });
});
