import { useMemo, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ceuSchema } from '@/validation/schemas';
import { useCeus, useRenewalPeriods } from '@/hooks/useData';
import { saveCeu } from '@/services/ceu';
import { ServiceError } from '@/services/errors';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

type FormValues = Omit<z.infer<typeof ceuSchema>, 'id' | 'createdAt' | 'updatedAt'>;

export interface CeuFormProps {
  initialValues?: FormValues;
  ceuId?: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}

/** Create/edit form for a continuing-education record. */
export function CeuForm({ initialValues, ceuId, onCancel, onSaved }: CeuFormProps) {
  const periods = useRenewalPeriods();
  const existing = useCeus();
  const toast = useToast();
  const isEdit = Boolean(ceuId);

  const defaults = useMemo<FormValues>(
    () =>
      initialValues ?? {
        title: '',
        provider: '',
        completionDate: '',
        credits: 0,
        category: '',
        renewalPeriodId: null,
        certificateRef: null,
        notes: null,
      },
    [initialValues],
  );

  const categories = useMemo(() => {
    const set = new Set(existing.map((c) => c.category.trim()).filter(Boolean));
    return [...set].sort();
  }, [existing]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ceuSchema.omit({ id: true, createdAt: true, updatedAt: true })),
    defaultValues: defaults,
    mode: 'onBlur',
  });

  const submitting = useRef(false);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (submitting.current) return; // prevent double submission
    submitting.current = true;
    try {
      const id = await saveCeu({ ...values, id: ceuId });
      toast.success(isEdit ? 'Changes saved.' : 'CEU record saved.');
      onSaved(id);
    } catch (error) {
      toast.error(error instanceof ServiceError ? error.message : 'We could not save this record.');
    } finally {
      submitting.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card max-w-2xl p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            label="Course or activity title"
            htmlFor="ceu-title"
            required
            error={errors.title?.message}
            hint="e.g. Trauma-Informed Care Workshop"
          >
            <Input id="ceu-title" invalid={!!errors.title} {...register('title')} />
          </Field>
        </div>

        <Field label="Provider" htmlFor="ceu-provider" required error={errors.provider?.message}>
          <Input id="ceu-provider" placeholder="e.g. State Counseling Association" invalid={!!errors.provider} {...register('provider')} />
        </Field>

        <Field
          label="Completion date"
          htmlFor="ceu-date"
          required
          error={errors.completionDate?.message}
        >
          <Input id="ceu-date" type="date" invalid={!!errors.completionDate} {...register('completionDate')} />
        </Field>

        <Field
          label="Credits"
          htmlFor="ceu-credits"
          required
          error={errors.credits?.message}
          hint="Use your board's credit unit (e.g. 6.0 CEUs)."
        >
          <Input
            id="ceu-credits"
            type="number"
            min={0}
            step={0.1}
            inputMode="decimal"
            invalid={!!errors.credits}
            {...register('credits', { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Category"
          htmlFor="ceu-category"
          required
          error={errors.category?.message}
          hint="Pick a previous category or type your own."
        >
          <>
            <Input
              id="ceu-category"
              list="ceu-category-options"
              placeholder="e.g. Ethics"
              invalid={!!errors.category}
              {...register('category')}
            />
            <datalist id="ceu-category-options">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        </Field>

        <Field
          label="Renewal period"
          htmlFor="ceu-period"
          error={errors.renewalPeriodId?.message}
          hint="Optional. Links this record to a renewal cycle."
        >
          <Select id="ceu-period" invalid={!!errors.renewalPeriodId} {...register('renewalPeriodId')}>
            <option value="">No renewal period</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Certificate reference" htmlFor="ceu-cert" error={errors.certificateRef?.message} hint="Optional — an ID or file name, not the certificate itself.">
          <Input id="ceu-cert" invalid={!!errors.certificateRef} {...register('certificateRef')} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="ceu-notes" error={errors.notes?.message}>
            <Textarea id="ceu-notes" invalid={!!errors.notes} {...register('notes')} />
          </Field>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-app-secondary-light px-3 py-2 text-xs text-app-secondary">
        CEU credits are tracked separately and are never added to your clinical or supervision hour totals.
      </p>

      <div className="mt-5 flex gap-2 border-t border-app-border pt-4">
        <Button type="submit" loading={isSubmitting}>
          {isEdit ? 'Save changes' : 'Save CEU record'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
