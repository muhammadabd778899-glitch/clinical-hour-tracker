import { describe, expect, it } from 'vitest';
import { runQualityCheck, summarizeIssues } from './quality';
import type { Activity, Category, CeURecord, RenewalPeriod, Requirement } from './types';

const categories: Category[] = [
  { id: 'direct', label: 'Direct', kind: 'direct', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'retired', label: 'Retired', kind: 'direct', active: false, sortOrder: 2, createdAt: '', updatedAt: '' },
  { id: 'sup', label: 'Supervision', kind: 'individual_supervision', active: true, sortOrder: 3, createdAt: '', updatedAt: '' },
];

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 'a1',
    type: 'clinical',
    categoryId: 'direct',
    title: 'Intake session',
    date: '2026-03-05',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    location: null,
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function ceu(overrides: Partial<CeURecord>): CeURecord {
  return {
    id: 'c1',
    title: 'Ethics course',
    provider: 'Board',
    completionDate: '2026-03-01',
    credits: 3,
    category: 'Ethics',
    renewalPeriodId: null,
    certificateRef: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function check(overrides: Partial<Parameters<typeof runQualityCheck>[0]> = {}) {
  return runQualityCheck({
    activities: [],
    categories,
    ceus: [],
    renewalPeriods: [],
    requirements: [],
    ...overrides,
  });
}

describe('runQualityCheck', () => {
  it('reports no issues for clean data', () => {
    expect(check({ activities: [activity({})] })).toEqual([]);
  });

  it('flags an empty title', () => {
    const issues = check({ activities: [activity({ title: '   ' })] });
    expect(issues.map((i) => i.code)).toContain('missing_title');
    expect(issues[0]?.severity).toBe('error');
  });

  it('flags missing classification', () => {
    const issues = check({ activities: [activity({ categoryId: null })] });
    expect(issues.map((i) => i.code)).toContain('missing_classification');
  });

  it('flags a category that no longer exists', () => {
    const issues = check({ activities: [activity({ categoryId: 'deleted' })] });
    expect(issues.map((i) => i.code)).toContain('missing_classification');
  });

  it('flags an inactive category', () => {
    const issues = check({ activities: [activity({ categoryId: 'retired' })] });
    expect(issues.map((i) => i.code)).toContain('inactive_category');
  });

  it('flags a type/category mismatch', () => {
    const issues = check({ activities: [activity({ type: 'clinical', categoryId: 'sup' })] });
    expect(issues.map((i) => i.code)).toContain('type_mismatch');
  });

  it('flags an end time that is not after the start time', () => {
    const issues = check({ activities: [activity({ startTime: '10:00', endTime: '09:00' })] });
    expect(issues.map((i) => i.code)).toContain('invalid_time_range');
  });

  it('flags zero and negative durations', () => {
    expect(check({ activities: [activity({ durationMinutes: 0 })] }).map((i) => i.code)).toContain('zero_duration');
    expect(check({ activities: [activity({ durationMinutes: -30 })] }).map((i) => i.code)).toContain('zero_duration');
  });

  it('flags fractional durations', () => {
    expect(check({ activities: [activity({ durationMinutes: 30.5 })] }).map((i) => i.code)).toContain('invalid_duration');
  });

  it('flags overlapping activities on the same day and links them', () => {
    const issues = check({
      activities: [
        activity({ id: 'a1', startTime: '09:00', endTime: '10:00' }),
        activity({ id: 'a2', title: 'Second session', startTime: '09:30', endTime: '10:30', createdAt: '2026-03-02T00:00:00.000Z' }),
      ],
    });
    const overlap = issues.find((i) => i.code === 'overlapping_activity');
    expect(overlap).toBeDefined();
    expect(overlap?.recordId).toBe('a2'); // the later-created record carries the warning
    expect(overlap?.message).toContain('Intake session');
  });

  it('does not flag adjacent (non-overlapping) activities', () => {
    const issues = check({
      activities: [
        activity({ id: 'a1', startTime: '09:00', endTime: '10:00' }),
        activity({ id: 'a2', title: 'Second', startTime: '10:00', endTime: '11:00' }),
      ],
    });
    expect(issues.map((i) => i.code)).not.toContain('overlapping_activity');
  });

  it('flags duplicate-looking records only once', () => {
    const issues = check({
      activities: [
        activity({ id: 'a1' }),
        activity({ id: 'a2', createdAt: '2026-03-02T00:00:00.000Z' }),
      ],
    });
    const duplicates = issues.filter((i) => i.code === 'duplicate_looking');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.recordId).toBe('a2');
  });

  it('flags activities outside every configured target period', () => {
    const requirement: Requirement = {
      id: 'r1',
      label: '600 hours',
      kind: 'clinical_total',
      categoryId: null,
      targetMinutes: 36000,
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    const inside = check({ activities: [activity({ date: '2026-03-05' })], requirements: [requirement] });
    expect(inside.map((i) => i.code)).not.toContain('activity_outside_periods');

    const outside = check({ activities: [activity({ date: '2026-08-05' })], requirements: [requirement] });
    expect(outside.map((i) => i.code)).toContain('activity_outside_periods');
  });

  it('flags incomplete CEU records', () => {
    const issues = check({ ceus: [ceu({ provider: '', credits: 0 })] });
    const issue = issues.find((i) => i.code === 'incomplete_ceu');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('provider');
    expect(issue?.message).toContain('credit amount');
  });

  it('flags CEU records completed outside their linked period', () => {
    const period: RenewalPeriod = {
      id: 'p1',
      label: '2026 cycle',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      targetCredits: 20,
      active: true,
      createdAt: '',
      updatedAt: '',
    };
    const issues = check({
      ceus: [ceu({ completionDate: '2025-11-01', renewalPeriodId: 'p1' })],
      renewalPeriods: [period],
    });
    expect(issues.map((i) => i.code)).toContain('ceu_outside_period');
  });

  it('sorts errors before warnings and gives every issue a stable id', () => {
    const issues = check({
      activities: [
        activity({ id: 'warn', categoryId: null }),
        activity({ id: 'err', title: 'Zero duration record', date: '2026-03-06', durationMinutes: 0 }),
      ],
    });
    expect(issues[0]?.severity).toBe('error');
    expect(new Set(issues.map((i) => i.id)).size).toBe(issues.length);
    expect(summarizeIssues(issues)).toEqual({ total: 2, errors: 1, warnings: 1 });
  });
});
