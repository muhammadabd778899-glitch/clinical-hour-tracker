import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/Card';
import { ActivityForm } from '@/components/activity/ActivityForm';
import { draftActivity } from '@/services/activity';
import type { ActivityFormValues } from '@/validation/schemas';
import type { ActivityType } from '@/domain/types';

const VALID_TYPES: ActivityType[] = ['clinical', 'supervision', 'other'];

/** Full-entry creation page (`/activities/new`). */
export function ActivityFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type: ActivityType = rawType && VALID_TYPES.includes(rawType as ActivityType)
    ? (rawType as ActivityType)
    : 'clinical';

  const initialValues = useMemo<ActivityFormValues>(() => draftActivity({ type }), [type]);

  return (
    <div>
      <PageHeader
        title={type === 'supervision' ? 'Log supervision' : 'Log an activity'}
        description="Fill in what you did, when, and how long it took. You can edit or delete this record later."
      />
      <ActivityForm
        initialValues={initialValues}
        onCancel={() => navigate('/activities')}
        onSaved={(id) => navigate(`/activities/${id}`, { replace: true })}
      />
    </div>
  );
}
