/**
 * Application-level errors with plain-language messages.
 * Internal/database details never reach the customer interface.
 */
export type ServiceErrorCode = 'validation' | 'not_found' | 'storage' | 'conflict';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

/** Turns the first Zod issue into a friendly message. */
export function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Please check the highlighted fields and try again.';
}

/** Friendly message for unexpected failures in the UI. */
export const GENERIC_SAVE_ERROR =
  'We could not save your change. Your data is stored on this device — please try again.';
export const GENERIC_LOAD_ERROR =
  'We could not load this information. Please refresh the page and try again.';
