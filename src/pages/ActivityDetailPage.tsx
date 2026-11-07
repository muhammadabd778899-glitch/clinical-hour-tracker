import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { Badge, ErrorState, LoadingState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ActivityForm } from '@/components/activity/ActivityForm';
import { useActivity, useCategories, useQualityIssues } from '@/hooks/useData';
import { deleteActivity } from '@/services/activity';
import { ServiceError } from '@/services/errors';
import { formatDuration } from '@/domain/duration';
import { formatDisplayDate, formatTimestamp } from '@/domain/date';
import type { ActivityFormValues } from '@/validation/schemas';

type ListContextState = { from?: string } | null;

const TYPE_LABEL = {
  clinical: 'Clinical activity',
  supervision: 'Supervision',
  other: 'Other professional activity',
} as const;

/**
 * Detail + edit route. Loads the record by stable id from the database
 * (never from list state), so refresh, Back/Forward and consecutive opens
 * always show the latest persisted record.
 */
export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const activity = useActivity(id);
  const categories = useCategories();
  const issues = useQualityIssues();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = location.pathname.endsWith('/edit');
  const backTo = (location.state as ListContextState)?.from ?? '/activities';

  if (activity === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading this record…" />
      </div>
    );
  }

  if (activity === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Record not found" />
        <ErrorState message="This activity does not exist on this device. It may have been deleted, or the link may be out of date." />
        <div className="mt-4">
          <Link to="/activities" className="btn-secondary">
            Back to Activity Log
          </Link>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === activity.categoryId);
  const recordIssues = issues.filter((i) => i.recordId === activity.id);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteActivity(activity.id);
      toast.success('Activity deleted.');
      navigate(backTo, { replace: true });
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not delete this activity.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const formValues: ActivityFormValues = {
    type: activity.type,
    categoryId: activity.categoryId,
    title: activity.title,
    date: activity.date,
    startTime: activity.startTime,
    endTime: activity.endTime,
    durationMinutes: activity.durationMinutes,
    location: activity.location,
    notes: activity.notes,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link to={backTo} className="text-sm text-app-secondary hover:underline">
          ← Back to list
        </Link>
      </div>

      {isEdit ? (
        <>
          <PageHeader title="Edit activity" description="Changes are saved only when you press Save." />
          <ActivityForm
            activityId={activity.id}
            initialValues={formValues}
            onCancel={() => navigate(`/activities/${activity.id}`, { replace: true })}
            onSaved={(savedId) => navigate(`/activities/${savedId}`, { replace: true })}
          />
        </>
      ) : (
        <>
          <PageHeader
            title={activity.title}
            actions={
              <>
                <Link to={`/activities/${activity.id}/edit`} state={location.state} className="btn-secondary">
                  Edit
                </Link>
                <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                  Delete
                </Button>
              </>
            }
          />

          <div className="card p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge tone={activity.type === 'supervision' ? 'info' : 'success'}>{TYPE_LABEL[activity.type]}</Badge>
              {category ? <Badge>{category.label}</Badge> : <Badge tone="warning">No category</Badge>}
              <Badge tone="neutral">{formatDuration(activity.durationMinutes)}</Badge>
            </div>

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Date</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDisplayDate(activity.date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Time</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {activity.startTime && activity.endTime
                    ? `${activity.startTime} – ${activity.endTime}`
                    : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Duration</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatDuration(activity.durationMinutes)} ({activity.durationMinutes} minutes)
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Location</dt>
                <dd className="mt-0.5 text-sm font-medium">{activity.location || 'Not recorded'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                  {activity.notes || <span className="text-app-muted">No notes</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Created</dt>
                <dd className="mt-0.5 text-sm text-app-muted">{formatTimestamp(activity.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Last updated</dt>
                <dd className="mt-0.5 text-sm text-app-muted">{formatTimestamp(activity.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {recordIssues.length > 0 && (
            <div className="card mt-4 border-app-warning/40 bg-app-warning-light p-4">
              <h3 className="text-app-warning">Record Quality Check</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {recordIssues.map((issue) => (
                  <li key={issue.id}>• {issue.message}</li>
                ))}
              </ul>
              <Link to="/quality" className="mt-2 inline-block text-sm font-medium text-app-secondary underline">
                Open Record Quality Check
              </Link>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this activity?"
        message={`"${activity.title}" and its ${activity.durationMinutes} minutes will be permanently removed from this device. This cannot be undone.`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
