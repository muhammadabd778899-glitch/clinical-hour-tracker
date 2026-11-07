import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-app-muted" role="status">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-app-primary border-t-transparent"
      />
      {label}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="card flex items-center justify-center p-10">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <h3>{title}</h3>
      <p className="max-w-md text-sm text-app-muted">{description}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary mt-2">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button type="button" className="btn-primary mt-2" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card border-app-danger/30 bg-app-danger-light p-6" role="alert">
      <h3 className="text-app-danger">Something went wrong</h3>
      <p className="mt-1 text-sm text-app-text">
        {message ?? 'We could not load this information. Please refresh the page and try again.'}
      </p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tones = {
    neutral: 'bg-gray-100 text-app-muted',
    success: 'bg-app-success-light text-app-success',
    warning: 'bg-app-warning-light text-app-warning',
    danger: 'bg-app-danger-light text-app-danger',
    info: 'bg-app-secondary-light text-app-secondary',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function ProgressBar({
  percent,
  label,
  tone = 'primary',
}: {
  percent: number;
  label: string;
  tone?: 'primary' | 'secondary';
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
    >
      <div
        className={`h-full rounded-full transition-all ${tone === 'primary' ? 'bg-app-primary' : 'bg-app-secondary'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
