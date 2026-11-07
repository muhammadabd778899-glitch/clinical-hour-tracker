import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

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
  icon = 'compass',
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-primary-light text-app-primary">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-app-muted">{description}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary mt-1">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button type="button" className="btn-primary mt-1" onClick={onAction}>
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
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
}) {
  const tones = {
    neutral: 'bg-app-bg text-app-muted ring-1 ring-inset ring-app-border',
    success: 'bg-app-success-light text-app-success',
    warning: 'bg-app-warning-light text-app-warning',
    danger: 'bg-app-danger-light text-app-danger',
    info: 'bg-app-secondary-light text-app-secondary',
    gold: 'bg-app-gold-light text-app-gold-dark',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

const BAR_TONES = {
  primary: 'from-[#0F6B5F] to-[#0D5B51]',
  secondary: 'from-[#3A7FA2] to-[#2C6B8A]',
  gold: 'from-[#C99B45] to-[#B98A33]',
  success: 'from-[#378F6C] to-[#2B7256]',
} as const;

export function ProgressBar({
  percent,
  label,
  tone = 'primary',
}: {
  percent: number;
  label: string;
  tone?: keyof typeof BAR_TONES;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-app-border/60"
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r ${BAR_TONES[tone]} transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
