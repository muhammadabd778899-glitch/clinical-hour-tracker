import { describe, expect, it } from 'vitest';
import { resolveClassification, summarizeActivities, EMPTY_SUMMARY } from './summary';
import type { Activity, Category } from './types';

const categories: Category[] = [
  { id: 'cat-direct', label: 'Direct', kind: 'direct', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'cat-indirect', label: 'Indirect', kind: 'indirect', active: true, sortOrder: 2, createdAt: '', updatedAt: '' },
  { id: 'cat-indiv', label: 'Individual', kind: 'individual_supervision', active: true, sortOrder: 3, createdAt: '', updatedAt: '' },
  { id: 'cat-group', label: 'Group', kind: 'group_supervision', active: true, sortOrder: 4, createdAt: '', updatedAt: '' },
  { id: 'cat-off', label: 'Retired', kind: 'direct', active: false, sortOrder: 5, createdAt: '', updatedAt: '' },
  { id: 'cat-other', label: 'Other', kind: 'other', active: true, sortOrder: 6, createdAt: '', updatedAt: '' },
];

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    type: 'clinical',
    categoryId: 'cat-direct',
    title: 'Session',
    date: '2026-03-05',
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    location: null,
    notes: null,
    createdAt: '2026-03-05T10:00:00.000Z',
    updatedAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('resolveClassification', () => {
  it('classifies matching type and category', () => {
    expect(resolveClassification({ type: 'clinical', categoryId: 'cat-direct' }, categories[0])).toEqual({
      bucket: 'direct',
      reason: 'ok',
    });
  });

  it('flags missing categories', () => {
    expect(resolveClassification({ type: 'clinical', categoryId: null }, undefined)).toEqual({
      bucket: null,
      reason: 'missing_category',
    });
    expect(resolveClassification({ type: 'clinical', categoryId: 'gone' }, undefined)).toEqual({
      bucket: null,
      reason: 'missing_category',
    });
  });

  it('flags inactive categories', () => {
    const off = categories.find((c) => c.id === 'cat-off')!;
    expect(resolveClassification({ type: 'clinical', categoryId: 'cat-off' }, off)).toEqual({
      bucket: null,
      reason: 'inactive_category',
    });
  });

  it('flags type/category mismatches so hours are not miscounted', () => {
    const indiv = categories.find((c) => c.id === 'cat-indiv')!;
    expect(resolveClassification({ type: 'clinical', categoryId: 'cat-indiv' }, indiv)).toEqual({
      bucket: null,
      reason: 'type_mismatch',
    });
  });
});

describe('summarizeActivities', () => {
  const activities: Activity[] = [
    activity({ id: '1', categoryId: 'cat-direct', durationMinutes: 120 }),
    activity({ id: '2', categoryId: 'cat-indirect', durationMinutes: 60 }),
    activity({ id: '3', type: 'supervision', categoryId: 'cat-indiv', durationMinutes: 50 }),
    activity({ id: '4', type: 'supervision', categoryId: 'cat-group', durationMinutes: 30 }),
    activity({ id: '5', type: 'other', categoryId: 'cat-other', durationMinutes: 45 }),
    activity({ id: '6', categoryId: 'cat-off', durationMinutes: 30 }),
    activity({ id: '7', categoryId: null, durationMinutes: 15 }),
    activity({ id: '8', type: 'clinical', categoryId: 'cat-indiv', durationMinutes: 10 }),
  ];

  it('returns an empty summary for no records', () => {
    expect(summarizeActivities([], categories)).toEqual(EMPTY_SUMMARY);
  });

  it('splits direct/indirect/supervision/other and keeps unclassified out of totals', () => {
    const summary = summarizeActivities(activities, categories);

    expect(summary.directMinutes).toBe(120);
    expect(summary.indirectMinutes).toBe(60);
    expect(summary.individualSupervisionMinutes).toBe(50);
    expect(summary.groupSupervisionMinutes).toBe(30);
    expect(summary.supervisionMinutes).toBe(80);
    expect(summary.otherMinutes).toBe(45);
    // Inactive category (30) + missing category (15) + type mismatch (10).
    expect(summary.unclassifiedMinutes).toBe(55);
    expect(summary.clinicalMinutes).toBe(180);
    expect(summary.totalTrackedMinutes).toBe(360);
    expect(summary.count).toBe(8);
  });

  it('adds supervision to the clinical total only when configured', () => {
    const withoutSupervision = summarizeActivities(activities, categories, {
      includeSupervisionInClinicalTotal: false,
    });
    const withSupervision = summarizeActivities(activities, categories, {
      includeSupervisionInClinicalTotal: true,
    });

    expect(withoutSupervision.clinicalMinutes).toBe(180);
    expect(withSupervision.clinicalMinutes).toBe(260);
    expect(withSupervision.supervisionMinutes).toBe(80);
  });

  it('tracks minutes per category for custom targets', () => {
    const summary = summarizeActivities(activities, categories);
    expect(summary.byCategory['cat-direct']).toBe(120);
    expect(summary.byCategory['cat-indirect']).toBe(60);
    expect(summary.byCategory['cat-off']).toBeUndefined();
  });

  it('groups raw minutes by activity type', () => {
    const summary = summarizeActivities(activities, categories);
    expect(summary.byType.clinical).toBe(235); // 120 + 60 + 30(off) + 15(null) + 10(mismatch)
    expect(summary.byType.supervision).toBe(80);
    expect(summary.byType.other).toBe(45);
  });

  it('is safe with an empty category list', () => {
    const summary = summarizeActivities([activity({})], []);
    expect(summary.unclassifiedMinutes).toBe(60);
    expect(summary.clinicalMinutes).toBe(0);
  });
});
