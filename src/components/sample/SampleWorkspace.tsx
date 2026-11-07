import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/feedback';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCounts, useSampleState } from '@/hooks/useData';
import { loadSampleWorkspace, removeSampleWorkspace } from '@/services/sample';
import { ServiceError } from '@/services/errors';

function message(error: unknown, fallback: string): string {
  return error instanceof ServiceError ? error.message : fallback;
}

/** Slim, always-visible reminder that the current records are demo data. */
export function SampleBanner() {
  const sample = useSampleState();
  const { activities, ceus } = useCounts();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!sample.active) return null;

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const result = await removeSampleWorkspace();
      toast.success(
        `Sample data removed — ${result.activities} activities, ${result.ceus} CEU records and ${result.requirements} targets. Your own records were kept.`,
      );
      setConfirmOpen(false);
    } catch (error) {
      toast.error(message(error, 'We could not remove the sample data.'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="no-print border-b border-app-gold/30 bg-app-gold-light">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs sm:px-6 sm:text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-app-gold-dark">
            <Icon name="spark" size={15} />
            Sample workspace
          </span>
          <span className="text-app-text/80">
            {activities} demo activities and {ceus} CEU records — explore freely, then clear it in one click.
          </span>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="w-full text-left font-semibold text-app-gold-dark underline underline-offset-2 hover:text-app-text sm:ml-auto sm:w-auto"
          >
            Remove sample data
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Remove the sample workspace?"
        message="Every demo record is deleted. Anything you logged yourself stays exactly as it is. You can load the sample again later from Settings."
        confirmLabel="Remove sample data"
        busy={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** Invitation shown on an empty workspace — a full demo year, no setup needed. */
export function SampleStartCard({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loadSampleWorkspace();
      toast.success('Sample workspace loaded. Look around — nothing here is your real data.');
    } catch (error) {
      toast.error(message(error, 'We could not load the sample workspace.'));
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <Card className="border-app-gold/40 bg-app-gold-light/60">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-app-gold-dark shadow-card">
            <Icon name="spark" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-app-text">Want to see it with data first?</p>
            <p className="text-xs text-app-muted">
              Load a realistic 12-week placement profile, then clear it whenever you like.
            </p>
          </div>
          <Button variant="gold" onClick={() => void load()} loading={loading}>
            Explore sample
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-app-gold/40 bg-gradient-to-br from-app-gold-light/80 via-white to-app-primary-light/50">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-app-gold-dark shadow-card">
          <Icon name="spark" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Preview</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-app-text">
            Explore with a full sample workspace
          </h3>
          <p className="mt-1 max-w-xl text-sm text-app-muted">
            See exactly how the tracker looks with a real placement profile: 12 weeks of sessions, supervision,
            CEU records and targets. It is clearly labelled, and removing it takes one click.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="gold" onClick={() => void load()} loading={loading}>
              Load sample workspace
            </Button>
            <span className="text-xs text-app-muted">Only possible while the workspace is empty.</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Settings card: status, load, and exact removal of demo records. */
export function SampleSettingsCard() {
  const sample = useSampleState();
  const { activities, ceus, requirements, renewalPeriods } = useCounts();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const empty = activities === 0 && ceus === 0 && requirements === 0 && renewalPeriods === 0;
  const canLoad = !sample.active && empty;

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loadSampleWorkspace();
      toast.success('Sample workspace loaded.');
    } catch (error) {
      toast.error(message(error, 'We could not load the sample workspace.'));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await removeSampleWorkspace();
      toast.success('Sample data removed. Your own records were kept.');
      setConfirmOpen(false);
    } catch (error) {
      toast.error(message(error, 'We could not remove the sample data.'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2>Sample workspace</h2>
        <Badge tone={sample.active ? 'gold' : 'neutral'}>{sample.active ? 'Sample loaded' : 'Not loaded'}</Badge>
      </div>
      <p className="mt-1 text-sm text-app-muted">
        A realistic demo profile for exploring every screen without entering your own records. Demo rows are marked
        and removed exactly — anything you add yourself is always kept.
      </p>

      {sample.active ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-app-bg px-3 py-2">
              <dt className="text-xs text-app-muted">Activities</dt>
              <dd className="font-semibold">{activities}</dd>
            </div>
            <div className="rounded-xl bg-app-bg px-3 py-2">
              <dt className="text-xs text-app-muted">CEU records</dt>
              <dd className="font-semibold">{ceus}</dd>
            </div>
            <div className="rounded-xl bg-app-bg px-3 py-2">
              <dt className="text-xs text-app-muted">Targets</dt>
              <dd className="font-semibold">{requirements}</dd>
            </div>
            <div className="rounded-xl bg-app-bg px-3 py-2">
              <dt className="text-xs text-app-muted">Renewal periods</dt>
              <dd className="font-semibold">{renewalPeriods}</dd>
            </div>
          </dl>
          <Button variant="danger" className="mt-3" onClick={() => setConfirmOpen(true)}>
            Remove sample data
          </Button>
        </>
      ) : canLoad ? (
        <Button variant="gold" className="mt-3" onClick={() => void load()} loading={loading}>
          Load sample workspace
        </Button>
      ) : (
        <p className="mt-3 rounded-lg bg-app-bg px-3 py-2 text-xs text-app-muted">
          Sample data can only be added to an empty workspace. Download a backup, erase your current records, then
          load the sample if you want to explore.
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Remove the sample workspace?"
        message="Every demo record is deleted. Anything you logged yourself stays exactly as it is."
        confirmLabel="Remove sample data"
        busy={removing}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
