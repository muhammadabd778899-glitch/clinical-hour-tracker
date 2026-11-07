import { beforeEach, describe, expect, it } from 'vitest';
import { ClinicalTrackerDB, initDatabase, setDB } from '@/db/database';
import { activityRepository, categoryRepository, settingsRepository } from '@/repositories';
import { createActivity } from '@/services/activity';
import {
  SAMPLE_DISPLAY_NAME,
  SAMPLE_META_KEY,
  canLoadSampleWorkspace,
  getSampleState,
  loadSampleWorkspace,
  removeSampleWorkspace,
  sampleCounts,
} from './sample';

let db: ClinicalTrackerDB;

beforeEach(async () => {
  db = new ClinicalTrackerDB(`sample-db-${crypto.randomUUID()}`);
  await initDatabase(db);
  setDB(db);
});

async function addOwnActivity(title = 'My own session'): Promise<string> {
  const categories = await categoryRepository.list(db);
  return createActivity(
    {
      type: 'clinical',
      categoryId: categories.find((c) => c.kind === 'direct')!.id,
      title,
      date: '2026-03-05',
      startTime: null,
      endTime: null,
      durationMinutes: 60,
      location: null,
      notes: null,
    },
    db,
  );
}

describe('sample workspace', () => {
  it('only loads into an empty workspace', async () => {
    expect(await canLoadSampleWorkspace(db)).toBe(true);
    await addOwnActivity();
    expect(await canLoadSampleWorkspace(db)).toBe(false);
    await expect(loadSampleWorkspace(db)).rejects.toThrow(/empty workspace/i);
  });

  it('writes a labelled demo profile and marks it active', async () => {
    await loadSampleWorkspace(db);

    const state = await getSampleState(db);
    expect(state.active).toBe(true);
    expect(state.loadedAt).not.toBeNull();

    const counts = await sampleCounts(db);
    expect(counts.activities).toBeGreaterThan(20);
    expect(counts.ceus).toBe(6);
    expect(counts.requirements).toBe(4);
    expect(counts.renewalPeriods).toBe(1);

    const activities = await activityRepository.list(db);
    expect(activities.every((a) => a.id.startsWith('sample-'))).toBe(true);
    expect(activities.every((a) => a.createdAt.length > 0)).toBe(true);

    const settings = await settingsRepository.get('app', null, db);
    expect(settings).toMatchObject({ onboarded: true, displayName: SAMPLE_DISPLAY_NAME });
    expect(await db.meta.get(SAMPLE_META_KEY)).toBeTruthy();
  });

  it('refuses to load twice', async () => {
    await loadSampleWorkspace(db);
    expect(await canLoadSampleWorkspace(db)).toBe(false);
    await expect(loadSampleWorkspace(db)).rejects.toThrow(/already loaded/i);
  });

  it('removes exactly the sample rows and keeps records the user added', async () => {
    await loadSampleWorkspace(db);
    const ownId = await addOwnActivity();

    const result = await removeSampleWorkspace(db);

    expect(result.activities).toBeGreaterThan(0);
    expect(result.ceus).toBe(6);
    expect(result.requirements).toBe(4);
    expect(result.renewalPeriods).toBe(1);

    const remaining = await activityRepository.list(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(ownId);
    expect(remaining[0]?.title).toBe('My own session');

    expect(await sampleCounts(db)).toMatchObject({ ceus: 0, requirements: 0, renewalPeriods: 0 });
    expect((await getSampleState(db)).active).toBe(false);
    expect(await db.meta.get(SAMPLE_META_KEY)).toBeUndefined();
  });

  it('keeps a name the user typed themselves when the sample is removed', async () => {
    await loadSampleWorkspace(db);
    await settingsRepository.set(
      'app',
      {
        onboarded: true,
        displayName: 'Jordan',
        profession: 'Licensed professional',
        includeSupervisionInClinicalTotal: false,
      },
      db,
    );

    await removeSampleWorkspace(db);
    const settings = await settingsRepository.get<{ displayName: string }>('app', { displayName: '' }, db);
    expect(settings.displayName).toBe('Jordan');
  });
});
