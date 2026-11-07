import { describe, expect, it } from 'vitest';
import { renewalProgress, renewalStatus, roundCredits, summarizeCeus } from './ceu';
import type { CeURecord, RenewalPeriod } from './types';

function ceu(overrides: Partial<CeURecord>): CeURecord {
  return {
    id: `ceu-${Math.random().toString(36).slice(2)}`,
    title: 'Workshop',
    provider: 'Provider',
    completionDate: '2026-03-01',
    credits: 1,
    category: 'Ethics',
    renewalPeriodId: null,
    certificateRef: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function period(overrides: Partial<RenewalPeriod>): RenewalPeriod {
  return {
    id: 'p1',
    label: '2026 renewal',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    targetCredits: 20,
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('summarizeCeus', () => {
  it('returns an empty summary for no records', () => {
    const summary = summarizeCeus([]);
    expect(summary.totalCredits).toBe(0);
    expect(summary.count).toBe(0);
  });

  it('totals credits by category and by period', () => {
    const summary = summarizeCeus([
      ceu({ id: '1', credits: 3, category: 'Ethics', renewalPeriodId: 'p1' }),
      ceu({ id: '2', credits: 2.5, category: 'Ethics', renewalPeriodId: 'p1' }),
      ceu({ id: '3', credits: 1, category: 'Clinical', renewalPeriodId: null }),
      ceu({ id: '4', credits: 0.5, category: 'Clinical', renewalPeriodId: 'p2' }),
    ]);

    expect(summary.totalCredits).toBe(7);
    expect(summary.count).toBe(4);
    expect(summary.byCategory['Ethics']).toBe(5.5);
    expect(summary.byCategory['Clinical']).toBe(1.5);
    expect(summary.byPeriod['p1']).toBe(5.5);
    expect(summary.unlinkedCredits).toBe(1);
  });

  it('ignores invalid credit amounts', () => {
    const summary = summarizeCeus([ceu({ id: '1', credits: -5 }), ceu({ id: '2', credits: Number.NaN })]);
    expect(summary.totalCredits).toBe(0);
  });

  it('rounds away floating point drift', () => {
    expect(roundCredits(0.1 + 0.2)).toBe(0.3);
  });
});

describe('renewalProgress', () => {
  it('reports status against the reference date', () => {
    expect(renewalStatus(period({}), '2025-12-31')).toBe('upcoming');
    expect(renewalStatus(period({}), '2026-06-01')).toBe('active');
    expect(renewalStatus(period({}), '2027-01-01')).toBe('ended');
  });

  it('totals credits linked to the period', () => {
    const progress = renewalProgress(
      period({}),
      [
        ceu({ id: '1', credits: 6, renewalPeriodId: 'p1' }),
        ceu({ id: '2', credits: 4, renewalPeriodId: 'p1' }),
        ceu({ id: '3', credits: 99, renewalPeriodId: 'other' }),
      ],
      '2026-06-01',
    );

    expect(progress.completedCredits).toBe(10);
    expect(progress.remainingCredits).toBe(10);
    expect(progress.percent).toBe(50);
    expect(progress.targetReached).toBe(false);
    expect(progress.status).toBe('active');
  });

  it('marks the target reached when credits meet the target', () => {
    const progress = renewalProgress(
      period({ targetCredits: 10 }),
      [ceu({ id: '1', credits: 10, renewalPeriodId: 'p1' })],
      '2026-06-01',
    );
    expect(progress.targetReached).toBe(true);
    expect(progress.remainingCredits).toBe(0);
    expect(progress.percent).toBe(100);
  });

  it('handles a period without a target', () => {
    const progress = renewalProgress(period({ targetCredits: 0 }), [], '2026-06-01');
    expect(progress.hasTarget).toBe(false);
    expect(progress.percent).toBe(0);
    expect(progress.targetReached).toBe(false);
  });

  it('counts days remaining to the end date', () => {
    const progress = renewalProgress(period({}), [], '2026-12-21');
    expect(progress.daysRemaining).toBe(10);
  });
});
