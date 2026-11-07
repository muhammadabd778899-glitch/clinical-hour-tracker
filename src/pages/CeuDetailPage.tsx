import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { Badge, ErrorState, LoadingState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CeuForm } from '@/components/ceu/CeuForm';
import { useCeu, useQualityIssues, useRenewalPeriods } from '@/hooks/useData';
import { deleteCeu } from '@/services/ceu';
import { ServiceError } from '@/services/errors';
import { formatDisplayDate, formatTimestamp } from '@/domain/date';
import { renewalProgress } from '@/domain/ceu';

/** CEU detail + edit route, loaded by stable id from the database. */
export function CeuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const ceu = useCeu(id);
  const periods = useRenewalPeriods();
  const issues = useQualityIssues();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEdit = location.pathname.endsWith('/edit');
  const backTo = (location.state as { from?: string } | null)?.from ?? '/ceus';

  if (ceu === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <LoadingState label="Loading this record…" />
      </div>
    );
  }

  if (ceu === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Record not found" />
        <ErrorState message="This CEU record does not exist on this device. It may have been deleted, or the link may be out of date." />
        <div className="mt-4">
          <Link to="/ceus" className="btn-secondary">
            Back to CEU Tracker
          </Link>
        </div>
      </div>
    );
  }

  const period = periods.find((p) => p.id === ceu.renewalPeriodId);
  const recordIssues = issues.filter((i) => i.recordId === ceu.id);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCeu(ceu.id);
      toast.success('CEU record deleted.');
      navigate(backTo, { replace: true });
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not delete this record.');
      setDeleting(false);
      setConfirmOpen(false);
    }
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
          <PageHeader title="Edit CEU record" />
          <CeuForm
            ceuId={ceu.id}
            initialValues={{
              title: ceu.title,
              provider: ceu.provider,
              completionDate: ceu.completionDate,
              credits: ceu.credits,
              category: ceu.category,
              renewalPeriodId: ceu.renewalPeriodId,
              certificateRef: ceu.certificateRef,
              notes: ceu.notes,
            }}
            onCancel={() => navigate(`/ceus/${ceu.id}`, { replace: true })}
            onSaved={(savedId) => navigate(`/ceus/${savedId}`, { replace: true })}
          />
        </>
      ) : (
        <>
          <PageHeader
            title={ceu.title}
            actions={
              <>
                <Link to={`/ceus/${ceu.id}/edit`} state={location.state} className="btn-secondary">
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
              <Badge tone="info">{ceu.category}</Badge>
              <Badge tone="success">{ceu.credits} credits</Badge>
              {period && (
                <Badge tone={renewalProgress(period, [ceu]).targetReached ? 'success' : 'neutral'}>
                  {period.label}
                </Badge>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Provider</dt>
                <dd className="mt-0.5 text-sm font-medium">{ceu.provider}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Completed</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDisplayDate(ceu.completionDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Credits</dt>
                <dd className="mt-0.5 text-sm font-medium">{ceu.credits}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Certificate</dt>
                <dd className="mt-0.5 text-sm font-medium">{ceu.certificateRef || 'Not recorded'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-app-muted">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm">{ceu.notes || <span className="text-app-muted">No notes</span>}</dd>
              </div>
              <div className="sm:col-span-2 text-xs text-app-muted">
                Created {formatTimestamp(ceu.createdAt)} · Updated {formatTimestamp(ceu.updatedAt)}
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
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this CEU record?"
        message={`"${ceu.title}" (${ceu.credits} credits) will be permanently removed from this device. This cannot be undone.`}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
