import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { CeuForm } from '@/components/ceu/CeuForm';

/** Full-entry CEU creation page (`/ceus/new`). */
export function CeuFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const renewalPeriodId = searchParams.get('period');

  return (
    <div>
      <PageHeader
        title="Add CEU record"
        description="Record a completed continuing-education activity. Credits never count as clinical hours."
      />
      <CeuForm
        initialValues={{
          title: '',
          provider: '',
          completionDate: '',
          credits: 0,
          category: '',
          renewalPeriodId: renewalPeriodId ?? null,
          certificateRef: null,
          notes: null,
        }}
        onCancel={() => navigate('/ceus')}
        onSaved={(id) => navigate(`/ceus/${id}`, { replace: true })}
      />
    </div>
  );
}
