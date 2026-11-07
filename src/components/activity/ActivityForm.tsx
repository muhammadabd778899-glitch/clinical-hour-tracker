import { useEffect, useMemo, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { activityFormSchema, type ActivityFormValues } from '@/validation/schemas';
import { computeDurationMinutes, formatDuration } from '@/domain/duration';
import { todayIso } from '@/domain/date';
import type { Category } from '@/domain/types';
import { useCategories, useSettings } from '@/hooks/useData';
import { createActivity, updateActivity } from '@/services/activity';
import { ServiceError } from '@/services/errors';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

const TYPE_OPTIONS = [
  { value: 'clinical', label: 'Clinical activity' },
  { value: 'supervision', label: 'Supervision' },
  { value: 'other', label: 'Other professional activity' },
] as const;

const KIND_LABEL: Record<string, string> = {
  clinical: 'Category',
  supervision: 'Supervision type',
  other: 'Activity type',
};

export function categoriesForType(categories: Category[], type: ActivityFormValues['type']): Category[] {
  const allowed =
    type === 'clinical'
      ? ['direct', 'indirect']
      : type === 'supervision'
        ? ['individual_supervision', 'group_supervision']
        : ['other'];
  return categories.filter((c) => c.active && allowed.includes(c.kind));
}

export interface ActivityFormProps {
  activityId?: string;
  initialValues?: ActivityFormValues;
  onCancel: () => void;
  onSaved: (id: string) => void;
}

/** Create/edit form shared by the full-entry page and the edit route. */
export function ActivityForm({ activityId, initialValues, onCancel, onSaved }: ActivityFormProps) {
  const categories = useCategories();
  const settings = useSettings();
  const toast = useToast();
  const isEdit = Boolean(activityId);

  const defaults = useMemo<ActivityFormValues>(
    () =>
      initialValues ?? {
        type: 'clinical',
        categoryId: null,
        title: '',
        date: todayIso(),
        startTime: null,
        endTime: null,
        durationMinutes: 0,
        location: null,
        notes: null,
      },
    [initialValues],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  const type = watch('type');
  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const durationMinutes = watch('durationMinutes');

  const typeOptions = categoriesForType(categories, type);

  // Keep the category valid for the selected activity type.
  const categoryId = watch('categoryId');
  const typeRef = useRef(type);
  useEffect(() => {
    if (typeRef.current !== type) {
      typeRef.current = type;
      const stillValid = typeOptions.some((c) => c.id === categoryId);
      if (!stillValid) setValue('categoryId', null, { shouldValidate: true });
    }
  }, [type, typeOptions, categoryId, setValue]);

  // Derive the duration from start/end times whenever they change.
  useEffect(() => {
    if (startTime && endTime) {
      const computed = computeDurationMinutes(startTime, endTime);
      if (computed !== null && computed !== durationMinutes) {
        setValue('durationMinutes', computed, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [startTime, endTime, durationMinutes, setValue]);

  const onSubmit: SubmitHandler<ActivityFormValues> = async (values) => {
    try {
      if (isEdit && activityId) {
        await updateActivity(activityId, values);
        toast.success('Changes saved.');
      } else {
        const id = await createActivity({ ...values });
        toast.success('Activity saved.');
        onSaved(id);
        return;
      }
      onSaved(activityId);
    } catch (error) {
      if (error instanceof ServiceError) toast.error(error.message);
      else toast.error('We could not save this activity. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card max-w-2xl p-5">
      {/* Activity type — the form adapts to this choice */}
      <fieldset className="mb-4">
        <legend className="label">Activity type</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TYPE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                type === option.value
                  ? 'border-app-primary bg-app-primary-light font-medium text-app-primary'
                  : 'border-app-border bg-white text-app-text'
              }`}
            >
              <input
                type="radio"
                value={option.value}
                {...register('type')}
                className="accent-app-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            label="Title"
            htmlFor="activity-title"
            required
            error={errors.title?.message}
            hint="A short label you will recognise later — avoid client names or identifying details."
          >
            <Input
              id="activity-title"
              placeholder="e.g. Intake session, Documentation, Case conference"
              invalid={!!errors.title}
              {...register('title')}
            />
          </Field>
        </div>

        <Field
          label={KIND_LABEL[type] ?? 'Category'}
          htmlFor="activity-category"
          required
          error={errors.categoryId?.message}
          hint="Decides which totals these hours count toward."
        >
          <Select id="activity-category" invalid={!!errors.categoryId} {...register('categoryId')}>
            <option value="">Choose a category…</option>
            {typeOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Date" htmlFor="activity-date" required error={errors.date?.message}>
          <Input
            id="activity-date"
            type="date"
            invalid={!!errors.date}
            {...register('date')}
          />
        </Field>

        <Field
          label="Start time"
          htmlFor="activity-start"
          error={errors.startTime?.message}
          hint="Optional. With an end time, the duration is filled in for you."
        >
          <Input id="activity-start" type="time" invalid={!!errors.startTime} {...register('startTime')} />
        </Field>

        <Field label="End time" htmlFor="activity-end" error={errors.endTime?.message}>
          <Input id="activity-end" type="time" invalid={!!errors.endTime} {...register('endTime')} />
        </Field>

        <Field
          label="Duration (minutes)"
          htmlFor="activity-duration"
          required
          error={errors.durationMinutes?.message}
          hint={
            durationMinutes > 0
              ? `That is ${formatDuration(durationMinutes)} of time.`
              : 'Whole minutes, e.g. 90 for 1 hour 30 minutes.'
          }
        >
          <Input
            id="activity-duration"
            type="number"
            min={1}
            max={1440}
            step={1}
            inputMode="numeric"
            invalid={!!errors.durationMinutes}
            {...register('durationMinutes', { valueAsNumber: true })}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Location or setting" htmlFor="activity-location" error={errors.location?.message}>
            <Input
              id="activity-location"
              placeholder="e.g. Campus clinic, Telehealth, School"
              invalid={!!errors.location}
              {...register('location')}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Notes"
            htmlFor="activity-notes"
            error={errors.notes?.message}
            hint="Please keep notes non-clinical: no client names, diagnoses, or confidential details."
          >
            <Textarea id="activity-notes" invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </div>
      </div>

      {!settings?.includeSupervisionInClinicalTotal && type === 'supervision' && (
        <p className="mt-3 rounded-lg bg-app-secondary-light px-3 py-2 text-xs text-app-secondary">
          Supervision hours are tracked separately from clinical hours. You can change this behaviour in
          Settings &amp; Help.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-app-border pt-4">
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Save activity'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Link to="/quality" className="btn-ghost ml-auto text-app-muted">
          Record Quality Check
        </Link>
      </div>
    </form>
  );
}
