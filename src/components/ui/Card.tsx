import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-app-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

const TILE_TONES = {
  primary: 'bg-app-primary-light text-app-primary',
  gold: 'bg-app-gold-light text-app-gold-dark',
  secondary: 'bg-app-secondary-light text-app-secondary',
  neutral: 'bg-app-bg text-app-muted',
} as const;

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  footer,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  tone?: keyof typeof TILE_TONES;
  footer?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-muted">{label}</p>
          <p className="stat-value mt-2 text-app-text">{value}</p>
          {hint && <p className="mt-1 text-sm text-app-muted">{hint}</p>}
        </div>
        {icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TILE_TONES[tone]}`}>
            <Icon name={icon} size={19} />
          </span>
        )}
      </div>
      {footer && <div className="mt-3 border-t border-app-border pt-2.5 text-xs text-app-muted">{footer}</div>}
    </Card>
  );
}
