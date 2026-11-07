import { describe, expect, it } from 'vitest';
import { computeProgress, filterToPeriod, requirementProgress } from './progress';
import type { Activity, Category, Requirement } from './types';

const categories: Category[] = [
  { id: 'direct', label: 'Direct', kind: 'direct', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'indirect', label: 'Indirect', kind: 'indirect', active: true, sortOrder: 2, createdAt: '', updatedAt: '' },
];

function activity(id: string, date: string, minutes: number, categoryId = 'direct'): Activity {
  return {
    id,
    type: 'clinical',
    categoryId,
    title: `Activity ${id}`,
    date,
    startTime: null,
    endTime: null,
    durationMinutes: minutes,
    location: null,
    notes: null,
    createdAt: date,
    updatedAt: date,
  };
}

function requirement(overrides: Partial<Requirement>): Requirement {
  return {
    id: 'req-1',
    label: 'Clinical hours',
    kind: 'clinical_total',
    categoryId: null,
    targetMinutes: 600,
    periodStart: null,
    periodEnd: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('computeProgress', () => {
  it('computes percent, remaining and reached state', () => {
    const result = computeProgress(600, 150);
    expect(result.percent).toBe(25);
    expect(result.remainingMinutes).toBe(450);
    expect(result.targetReached).toBe(false);
    expect(result.hasTarget).toBe(true);
  });

  it('handles reaching exactly the target', () => {
    const result = computeProgress(600, 600);
    expect(result.percent).toBe(100);
    expect(result.targetReached).toBe(true);
    expect(result.remainingMinutes).toBe(0);
  });

  it('allows progress above 100% but never negative remaining', () => {
    const result = computeProgress(600, 720);
    expect(result.percent).toBe(120);
    expect(result.remainingMinutes).toBe(0);
    expect(result.targetReached).toBe(true);
  });

  it('treats a missing target as "no target set"', () => {
    expect(computeProgress(0, 100).hasTarget).toBe(false);
    expect(computeProgress(0, 100).percent).toBe(0);
    expect(computeProgress(0, 100).targetReached).toBe(false);
    expect(computeProgress(-5, 100).hasTarget).toBe(false);
  });

  it('guards against non-finite input', () => {
    expect(computeProgress(600, Number.NaN).completedMinutes).toBe(0);
    expect(computeProgress(Number.NaN, 100).hasTarget).toBe(false);
  });
});

describe('filterToPeriod', () => {
  const activities = [activity('a', '2026-01-15', 60), activity('b', '2026-03-15', 60), activity('c', '2026-06-15', 60)];

  it('returns everything when no period is configured', () => {
    expect(filterToPeriod(activities, null, null)).toHaveLength(3);
  });

  it('keeps only activities inside the period', () => {
    const filtered = filterToPeriod(activities, '2026-02-01', '2026-04-30');
    expect(filtered.map((a) => a.id)).toEqual(['b']);
  });

  it('supports open-ended periods', () => {
    expect(filterToPeriod(activities, '2026-03-01', null)).toHaveLength(2);
    expect(filterToPeriod(activities, null, '2026-02-01')).toHaveLength(1);
  });
});

describe('requirementProgress', () => {
  const activities = [
    activity('a', '2026-01-15', 120, 'direct'),
    activity('b', '2026-03-15', 60, 'indirect'),
    activity('c', '2026-06-15', 30, 'direct'),
  ];

  it('sums direct + indirect for a clinical total target', () => {
    const progress = requirementProgress(requirement({}), activities, categories);
    expect(progress.completedMinutes).toBe(210);
    expect(progress.percent).toBe(35);
  });

  it('restricts counting to the configured period', () => {
    const progress = requirementProgress(
      requirement({ periodStart: '2026-01-01', periodEnd: '2026-02-28' }),
      activities,
      categories,
    );
    expect(progress.completedMinutes).toBe(120);
  });

  it('measures a specific category for custom targets', () => {
    const progress = requirementProgress(requirement({ kind: 'custom_category', categoryId: 'indirect' }), activities, categories);
    expect(progress.completedMinutes).toBe(60);
    expect(progress.percent).toBe(10);
  });

  it('returns zero for a custom target whose category was removed', () => {
    const progress = requirementProgress(requirement({ kind: 'custom_category', categoryId: 'gone' }), activities, categories);
    expect(progress.completedMinutes).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('separates supervision from clinical totals', () => {
    const supervisionActivities: Activity[] = [
      { ...activity('s', '2026-02-01', 100), type: 'supervision', categoryId: null },
    ];
    const clinical = requirementProgress(requirement({ kind: 'clinical_total' }), supervisionActivities, categories);
    const supervision = requirementProgress(requirement({ kind: 'supervision_total' }), supervisionActivities, categories);

    expect(clinical.completedMinutes).toBe(0);
    expect(supervision.completedMinutes).toBe(0); // unclassified supervision counts nowhere
  });

  it('handles no activities at all', () => {
    const progress = requirementProgress(requirement({}), [], categories);
    expect(progress.completedMinutes).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.targetReached).toBe(false);
  });
});
