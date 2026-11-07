import { useMemo, useState } from 'react';
import { PageHeader, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/Toast';
import {
  useActivities,
  useCeus,
  useCategories,
  useRenewalPeriods,
  useRequirements,
  useSettings,
} from '@/hooks/useData';
import {
  buildReport,
  describeFilters,
  DEFAULT_FILTERS,
  REPORT_LABELS,
  type ReportFilters,
  type ReportType,
} from '@/domain/reports';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { downloadCsv, downloadJson, fileTimestamp } from '@/services/export';
import { createBackup } from '@/services/backup';
import type { ActivityType } from '@/domain/types';

const REPORT_TYPES = Object.entries(REPORT_LABELS) as [ReportType, string][];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'clinical', label: 'Clinical' },
  { value: 'supervision', label: 'Supervision' },
  { value: 'other', label: 'Other' },
];

/** Report Studio — previews and exports built from the shared domain layer. */
export function ReportsPage() {
  const activities = useActivities();
  const categories = useCategories();
  const requirements = useRequirements();
  const ceus = useCeus();
  const periods = useRenewalPeriods();
  const settings = useSettings();
  const toast = useToast();

  const [type, setType] = useState<ReportType>('clinical_hours');
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [exporting, setExporting] = useState(false);

  const report = useMemo(
    () =>
      buildReport({
        type,
        filters,
        activities,
        categories,
        ceus,
        requirements,
        renewalPeriods: periods,
        settings: settings ?? DEFAULT_SETTINGS,
      }),
    [type, filters, activities, categories, ceus, requirements, periods, settings],
  );

  const filterDescription = describeFilters(filters);

  const toggleTypeFilter = (value: ActivityType) => {
    setFilters((f) => {
      const current = f.activityTypes ?? [];
      const next = current.includes(value) ? current.filter((t) => t !== value) : [...current, value];
      return { ...f, activityTypes: next.length === 0 ? null : next };
    });
  };

  const toggleCategoryFilter = (id: string) => {
    setFilters((f) => {
      const current = f.categoryIds ?? [];
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      return { ...f, categoryIds: next.length === 0 ? null : next };
    });
  };

  const handleCsv = () => {
    downloadCsv(`${type}-report-${fileTimestamp()}.csv`, report, filterDescription);
    toast.success('CSV downloaded.');
  };

  const handleBackup = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const backup = await createBackup();
      downloadJson(`clinical-tracker-backup-${fileTimestamp()}.json`, backup);
      toast.success('Backup file downloaded.');
    } catch {
      toast.error('We could not create the backup file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const hasRows = report.rows.length > 0;

  return (
    <div>
      <div className="print-only mb-4">
        <h1>{report.title}</h1>
        <p>
          Generated {report.generatedAt} · {filterDescription}
        </p>
        <p>All in One Clinical Tracker — local progress record, not a regulatory record.</p>
      </div>

      <PageHeader
        title="Report Studio"
        eyebrow="Summaries & exports"
        description="Organised summaries of your hours, supervision, CEUs and target progress — exportable as CSV or a printable PDF."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()} disabled={!hasRows}>
              Print / Save as PDF
            </Button>
            <Button variant="secondary" onClick={handleCsv} disabled={!hasRows}>
              Download CSV
            </Button>
            <Button onClick={handleBackup} loading={exporting}>
              Export JSON backup
            </Button>
          </>
        }
      />

      <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Report" htmlFor="report-type">
          <Select id="report-type" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {REPORT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" htmlFor="report-start" hint="Leave empty for all time.">
          <Input
            id="report-start"
            type="date"
            value={filters.start ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value || null }))}
          />
        </Field>
        <Field label="To" htmlFor="report-end">
          <Input
            id="report-end"
            type="date"
            value={filters.end ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value || null }))}
          />
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </Button>
        </div>

        {type !== 'ceu' && (
          <div className="sm:col-span-2 lg:col-span-2">
            <p className="label">Activity types</p>
            <div className="flex flex-wrap gap-3">
              {ACTIVITY_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="accent-app-primary"
                    checked={filters.activityTypes?.includes(t.value) ?? false}
                    onChange={() => toggleTypeFilter(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="label">Categories</p>
          <div className="flex max-h-24 flex-wrap gap-3 overflow-y-auto">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-app-primary"
                  checked={filters.categoryIds?.includes(c.id) ?? false}
                  onChange={() => toggleCategoryFilter(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2>{report.title}</h2>
            <p className="text-xs text-app-muted">
              {filterDescription} · Generated {report.generatedAt}
            </p>
          </div>
          <p className="text-sm text-app-muted">
            {report.totals.minutes > 0 && (
              <>
                <strong className="text-app-text">{report.totals.hours}</strong> hours ·{' '}
              </>
            )}
            {report.totals.credits > 0 && (
              <>
                <strong className="text-app-text">{report.totals.credits}</strong> credits ·{' '}
              </>
            )}
            <strong className="text-app-text">{report.totals.count}</strong> record
            {report.totals.count === 1 ? '' : 's'}
          </p>
        </div>

        {!hasRows ? (
          <EmptyState
            title="Nothing to report yet"
            description="There are no records matching this report and its filters. Try a wider date range or log your first activity."
            actionLabel="Log an activity"
            actionTo="/activities/new?type=clinical"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border text-left text-xs uppercase tracking-wide text-app-muted">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Records</th>
                  <th className="py-2 pr-3 text-right">Hours</th>
                  <th className="py-2 pr-3 text-right">Credits</th>
                  <th className="py-2 pr-3 text-right">Target</th>
                  <th className="py-2 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={`${row.label}-${index}`} className="border-b border-app-border/60">
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    <td className="py-2 pr-3 text-right">{row.count || '—'}</td>
                    <td className="py-2 pr-3 text-right">
                      {row.minutes > 0 ? (row.minutes / 60).toFixed(2).replace(/\.00$/, '') : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right">{row.credits > 0 ? row.credits : '—'}</td>
                    <td className="py-2 pr-3 text-right">
                      {row.targetMinutes !== null ? (row.targetMinutes / 60).toFixed(2).replace(/\.00$/, '') : '—'}
                    </td>
                    <td className="py-2 text-right">{row.percent !== null ? `${row.percent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-app-muted">
          Totals on this page use the same calculations as your Overview and Requirements pages. This report reflects
          your local records only and is not an official or regulatory document.
        </p>
      </Card>
    </div>
  );
}
