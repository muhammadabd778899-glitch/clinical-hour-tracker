/**
 * Zod schemas — the validation gate for every record that enters the database
 * or arrives through a backup import.
 */
import { z } from 'zod';
import { computeDurationMinutes, MAX_DURATION_MINUTES } from '@/domain/duration';
import { isDateStr, isTimeStr } from '@/domain/date';

const dateStr = z
  .string()
  .refine(isDateStr, { message: 'Enter a valid date (for example 2026-03-05).' });

const timeStr = z
  .string()
  .refine(isTimeStr, { message: 'Enter a valid time (for example 14:30).' });

const optionalText = (max: number) =>
  z
    .string()
    .max(max, { message: `Keep this under ${max} characters.` })
    .transform((v) => (v.trim() === '' ? null : v.trim()))
    .nullable()
    .optional();

const activityFields = {
  type: z.enum(['clinical', 'supervision', 'other']),
  categoryId: z.string().min(1).nullable(),
  title: z
    .string()
    .trim()
    .min(1, { message: 'Give this activity a short title.' })
    .max(120, { message: 'Keep the title under 120 characters.' }),
  date: dateStr,
  startTime: timeStr.nullable().optional(),
  endTime: timeStr.nullable().optional(),
  durationMinutes: z
    .number({ message: 'Enter how long the activity lasted.' })
    .int('Duration must be a whole number of minutes.')
    .positive('Duration must be greater than zero.')
    .max(MAX_DURATION_MINUTES, 'Duration cannot be longer than 24 hours.'),
  location: optionalText(120),
  notes: optionalText(2000),
};

/** Shared refinement: times must be consistent with the stored duration. */
function validateTimeConsistency(
  value: { startTime?: string | null; endTime?: string | null; durationMinutes: number },
  ctx: z.RefinementCtx,
): void {
  const start = value.startTime ?? null;
  const end = value.endTime ?? null;
  if (start && end) {
    const computed = computeDurationMinutes(start, end);
    if (computed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'The end time must be after the start time.',
      });
    } else if (computed !== value.durationMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['durationMinutes'],
        message: 'Duration does not match the start and end times.',
      });
    }
  }
}

/** Form shape (no id/timestamps — those are assigned by the service). */
export const activityFormSchema = z.object(activityFields).superRefine(validateTimeConsistency);
export type ActivityFormValues = z.infer<typeof activityFormSchema>;

/** Full stored record shape. */
export const activitySchema = z
  .object({
    id: z.string().min(1),
    ...activityFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine(validateTimeConsistency);

export type ActivityInput = z.input<typeof activitySchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, { message: 'Give the category a name.' })
    .max(80, { message: 'Keep the name under 80 characters.' }),
  kind: z.enum(['direct', 'indirect', 'individual_supervision', 'group_supervision', 'other']),
  active: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const requirementSchema = z
  .object({
    id: z.string().min(1),
    label: z
      .string()
      .trim()
      .min(1, { message: 'Give this target a name.' })
      .max(120, { message: 'Keep the name under 120 characters.' }),
    kind: z.enum([
      'clinical_total',
      'direct',
      'indirect',
      'supervision_total',
      'individual_supervision',
      'group_supervision',
      'custom_category',
    ]),
    categoryId: z.string().min(1).nullable(),
    targetMinutes: z
      .number({ message: 'Enter a target.' })
      .int('Targets use whole minutes.')
      .positive('Target must be greater than zero.'),
    periodStart: dateStr.nullable().optional(),
    periodEnd: dateStr.nullable().optional(),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'custom_category' && !value.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'Choose which category this target applies to.',
      });
    }
    if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodEnd'],
        message: 'The period end must be on or after the period start.',
      });
    }
  });
export type RequirementInput = z.input<typeof requirementSchema>;
export const renewalPeriodSchema = z
  .object({
    id: z.string().min(1),
    label: z
      .string()
      .trim()
      .min(1, { message: 'Give the period a name.' })
      .max(120, { message: 'Keep the name under 120 characters.' }),
    startDate: dateStr,
    endDate: dateStr,
    targetCredits: z
      .number({ message: 'Enter a credit target.' })
      .nonnegative('Credits cannot be negative.')
      .max(10_000, 'That target looks too large.'),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The end date must be on or after the start date.',
      });
    }
  });

export const ceuSchema = z.object({
  id: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, { message: 'Enter the course or activity title.' })
    .max(160, { message: 'Keep the title under 160 characters.' }),
  provider: z
    .string()
    .trim()
    .min(1, { message: 'Enter who provided it (e.g. an organization).' })
    .max(160, { message: 'Keep the provider under 160 characters.' }),
  completionDate: dateStr,
  credits: z
    .number({ message: 'Enter how many credits you earned.' })
    .positive('Credits must be greater than zero.')
    .max(1000, 'That looks too large for a single entry.'),
  category: z
    .string()
    .trim()
    .min(1, { message: 'Choose or enter a category.' })
    .max(80, { message: 'Keep the category under 80 characters.' }),
  renewalPeriodId: z.string().min(1).nullable().optional(),
  certificateRef: optionalText(160),
  notes: optionalText(2000),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const settingsSchema = z.object({
  onboarded: z.boolean(),
  displayName: z.string().max(80),
  profession: z.string().max(80),
  includeSupervisionInClinicalTotal: z.boolean(),
});
