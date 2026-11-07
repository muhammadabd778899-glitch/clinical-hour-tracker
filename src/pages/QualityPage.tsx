import { Link } from 'react-router-dom';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { useQualityIssues } from '@/hooks/useData';
import { summarizeIssues } from '@/domain/quality';

const RULES_EXPLAINED: string[] = [
  'Missing or empty required fields (titles, categories, CEU details).',
  'End times that are not after the start time.',
  'Zero or negative durations.',
  'Activities that overlap on the same day.',
  'Records that look like duplicates of one another.',
  'Classifications that do not match the activity type, or categories that are turned off.',
  'Activities that fall outside every configured target period.',
  'CEU records linked to a period but completed outside its dates.',
];

/** Record Quality Check — read-only, explainable, with links to each record. */
export function QualityPage() {
  const issues = useQualityIssues();
  const summary = summarizeIssues(issues);

  return (
    <div>
      <PageHeader
        title="Record Quality Check"
        description="A read-only review of your records. Nothing here changes your data — every warning links to the record so you can decide what to do."
        actions={
          <Link to="/activities" className="btn-secondary">
            Go to Activity Log
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-app-muted">Records checked</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total === 0 ? '0 issues' : `${summary.total}`}</p>
          <p className="text-sm text-app-muted">
            {summary.total === 0 ? 'Everything looks consistent' : 'found across your records'}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-app-muted">Needs fixing</p>
          <p className="mt-1 text-2xl font-semibold text-app-danger">{summary.errors}</p>
          <p className="text-sm text-app-muted">errors that hide hours from totals</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-app-muted">Worth reviewing</p>
          <p className="mt-1 text-2xl font-semibold text-app-warning">{summary.warnings}</p>
          <p className="text-sm text-app-muted">possible duplicates or odd dates</p>
        </Card>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          title="No issues found"
          description="Every record has a title, a category, a valid duration and a sensible date. Keep it up!"
          actionLabel="View activity log"
          actionTo="/activities"
        />
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li key={issue.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                      {issue.severity === 'error' ? 'Needs fixing' : 'Review'}
                    </Badge>
                    <span className="text-sm font-semibold">{issue.recordLabel}</span>
                    <span className="text-xs text-app-muted">
                      {issue.recordType === 'activity' ? 'Activity' : 'CEU record'}
                    </span>
                  </div>
                  <p className="text-sm text-app-text">{issue.message}</p>
                </div>
                <Link
                  to={issue.recordType === 'activity' ? `/activities/${issue.recordId}` : `/ceus/${issue.recordId}`}
                  state={{ from: '/quality' }}
                  className="btn-secondary shrink-0"
                >
                  Review record
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <h3>What this check looks for</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-muted">
          {RULES_EXPLAINED.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-app-muted">
          The check never edits or deletes anything. Duplicate warnings are suggestions for you to review.
        </p>
      </Card>
    </div>
  );
}
