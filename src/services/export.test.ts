import { describe, expect, it } from 'vitest';
import { csvCell, reportToCsv, fileTimestamp } from './export';
import { buildReport, DEFAULT_FILTERS, REPORT_LABELS } from '@/domain/reports';
import type { Activity, Category } from '@/domain/types';

const categories: Category[] = [
  { id: 'direct', label: 'Direct', kind: 'direct', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
];

const activities: Activity[] = [
  {
    id: 'a1',
    type: 'clinical',
    categoryId: 'direct',
    title: 'Session, with "quotes"',
    date: '2026-03-05',
    startTime: null,
    endTime: null,
    durationMinutes: 90,
    location: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
});

describe('reportToCsv', () => {
  it('produces a valid CSV with metadata, rows and totals', () => {
    const report = buildReport({
      type: 'clinical_hours',
      filters: DEFAULT_FILTERS,
      activities,
      categories,
      ceus: [],
      requirements: [],
      renewalPeriods: [],
      settings: { includeSupervisionInClinicalTotal: false },
      now: new Date('2026-03-05T12:00:00Z'),
    });

    const csv = reportToCsv(report, 'Dates: all time · Types: all');
    expect(csv.startsWith('\uFEFF')).toBe(true); // Excel-friendly BOM
    expect(csv).toContain('Report,Clinical hours report');
    expect(csv).toContain('Filters,Dates: all time · Types: all');
    expect(csv).toContain('Item,Records,Hours,Minutes,CEU credits,Target hours,Progress %');
    expect(csv).toContain('Total clinical hours');
    expect(csv).toContain('Totals');

    const lines = csv.trim().split('\r\n');
    expect(lines.length).toBeGreaterThan(5);
    // 90 minutes of direct work must appear as 1.5 hours / 90 minutes.
    expect(csv).toContain('Direct hours,0,1.5,90,,,');
    expect(csv).toContain('Total clinical hours,1,1.5,90,,,');
  });

  it('handles an empty report without crashing', () => {
    const report = buildReport({
      type: 'ceu',
      filters: DEFAULT_FILTERS,
      activities: [],
      categories: [],
      ceus: [],
      requirements: [],
      renewalPeriods: [],
      settings: { includeSupervisionInClinicalTotal: false },
    });
    const csv = reportToCsv(report, 'Dates: all time');
    expect(csv).toContain(REPORT_LABELS.ceu);
    expect(csv).toContain('Totals');
  });
});

describe('fileTimestamp', () => {
  it('builds a file-safe timestamp', () => {
    expect(fileTimestamp(new Date(2026, 2, 5, 9, 5))).toBe('2026-03-05-0905');
  });
});
