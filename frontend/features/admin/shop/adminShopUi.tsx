import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { formatShopPrice } from '../../../lib/shopFormat';
import { Badge } from '../../../components/tailadmin/Badge';

export const TA_CARD =
  'rounded-2xl border border-gray-200/90 bg-white shadow-default transition-shadow duration-300 dark:border-gray-800 dark:bg-white/[0.03]';

export const TA_INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-white/[0.04] dark:text-white';

export const TA_SELECT = TA_INPUT;

export function formatAdminPrice(amount: number, language: string, currency = 'EGP') {
  return formatShopPrice(amount, currency, language);
}

type StatTone = 'brand' | 'success' | 'warning' | 'info';

const statThemes: Record<
  StatTone,
  { bar: string; glow: string; iconWrap: string; icon: string; value: string }
> = {
  brand: {
    bar: 'from-brand-500 to-brand-600',
    glow: 'bg-brand-500/10',
    iconWrap: 'bg-gradient-to-br from-brand-500/20 to-brand-500/5 ring-1 ring-brand-500/20',
    icon: 'text-brand-600 dark:text-brand-400',
    value: 'text-gray-900 dark:text-white',
  },
  success: {
    bar: 'from-success-500 to-emerald-600',
    glow: 'bg-success-500/10',
    iconWrap: 'bg-gradient-to-br from-success-500/20 to-success-500/5 ring-1 ring-success-500/20',
    icon: 'text-success-600 dark:text-success-500',
    value: 'text-gray-900 dark:text-white',
  },
  warning: {
    bar: 'from-warning-500 to-amber-600',
    glow: 'bg-warning-500/10',
    iconWrap: 'bg-gradient-to-br from-warning-500/20 to-warning-500/5 ring-1 ring-warning-500/20',
    icon: 'text-warning-500',
    value: 'text-gray-900 dark:text-white',
  },
  info: {
    bar: 'from-sky-500 to-blue-600',
    glow: 'bg-sky-500/10',
    iconWrap: 'bg-gradient-to-br from-sky-500/20 to-sky-500/5 ring-1 ring-sky-500/20',
    icon: 'text-sky-600 dark:text-sky-400',
    value: 'text-gray-900 dark:text-white',
  },
};

export const AdminLoading: React.FC<{ label: string }> = ({ label }) => (
  <div className={cn(TA_CARD, 'flex items-center justify-center gap-3 p-12')}>
    <span className="size-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
  </div>
);

export const AdminAlert: React.FC<{ children: React.ReactNode; tone?: 'error' | 'info' }> = ({
  children,
  tone = 'error',
}) => (
  <div
    className={cn(
      'rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-sm',
      tone === 'error'
        ? 'border-error-500/30 bg-gradient-to-r from-error-500/10 to-error-500/5 text-error-500'
        : 'border-brand-500/30 bg-gradient-to-r from-brand-500/10 to-brand-500/5 text-brand-500'
    )}
  >
    {children}
  </div>
);

export const AdminEmptyState: React.FC<{ icon: string; title: string; subtitle?: string }> = ({
  icon,
  title,
  subtitle,
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-14 text-center dark:border-gray-700 dark:bg-white/[0.02]">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/[0.06]">
      <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-500">{icon}</span>
    </div>
    <p className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</p>
    {subtitle ? <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
  </div>
);

interface AdminStatCardProps {
  label: string;
  value: string;
  icon: string;
  tone?: StatTone;
  hint?: string;
  featured?: boolean;
  to?: string;
}

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
  label,
  value,
  icon,
  tone = 'brand',
  hint,
  featured = false,
  to,
}) => {
  const theme = statThemes[tone];
  const card = (
    <div
      className={cn(
        TA_CARD,
        'group relative overflow-hidden hover:shadow-lg',
        to && 'cursor-pointer transition hover:-translate-y-0.5',
        featured ? 'p-5 sm:p-6' : 'p-4 sm:p-5'
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', theme.bar)} />
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 size-28 rounded-full opacity-80 blur-2xl transition-opacity group-hover:opacity-100',
          theme.glow
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p
            className={cn(
              'break-words font-bold tabular-nums leading-tight tracking-tight',
              theme.value,
              featured ? 'text-2xl sm:text-[1.65rem]' : 'text-xl sm:text-2xl'
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
          ) : (
            <div className="h-4" />
          )}
        </div>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105',
            theme.iconWrap,
            featured ? 'size-12' : 'size-11'
          )}
        >
          <span className={cn('material-symbols-outlined', theme.icon, featured ? 'text-[24px]' : 'text-[22px]')}>
            {icon}
          </span>
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline">
        {card}
      </Link>
    );
  }
  return card;
};

interface AdminSectionProps {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export const AdminSection: React.FC<AdminSectionProps> = ({ title, subtitle, icon, children, className }) => (
  <section className={cn('space-y-4', className)}>
    <div className="flex items-start gap-3">
      {icon ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/15">
          <span className="material-symbols-outlined text-brand-500">{icon}</span>
        </div>
      ) : null}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

interface AdminPanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: string;
  accent?: StatTone;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  icon,
  accent = 'brand',
}) => {
  const theme = statThemes[accent];
  return (
    <section className={cn(TA_CARD, 'group overflow-hidden hover:shadow-lg', className)}>
      <div className="relative border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white px-5 py-4 dark:border-gray-800 dark:from-white/[0.04] dark:to-transparent sm:px-6">
        <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80', theme.bar)} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {icon ? (
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', theme.iconWrap)}>
                <span className={cn('material-symbols-outlined text-[20px]', theme.icon)}>{icon}</span>
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
            </div>
          </div>
          {action ? <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">{action}</div> : null}
        </div>
      </div>
      <div className={cn('p-5 sm:p-6', bodyClassName)}>{children}</div>
    </section>
  );
};

export const AdminListRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}> = ({ children, className, highlight }) => (
  <li
    className={cn(
      'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors',
      highlight
        ? 'border-brand-500/25 bg-gradient-to-r from-brand-500/[0.06] to-transparent'
        : 'border-gray-100 bg-white/60 hover:border-gray-200 hover:bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]',
      className
    )}
  >
    {children}
  </li>
);

export const AdminQuickAction: React.FC<{
  to: string;
  icon: string;
  label: string;
}> = ({ to, icon, label }) => (
  <Link
    to={to}
    className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50/90 to-white px-4 py-3.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/35 hover:shadow-md dark:border-gray-800 dark:from-white/[0.04] dark:to-transparent dark:text-white/90"
  >
    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500/10 ring-1 ring-brand-500/15 transition group-hover:bg-brand-500/15">
      <span className="material-symbols-outlined text-[20px] text-brand-500">{icon}</span>
    </span>
    <span className="flex-1">{label}</span>
    <span className="material-symbols-outlined text-base text-gray-400 transition group-hover:text-brand-500">
      chevron_right
    </span>
  </Link>
);

export const AdminTableWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-shop-table-scroll overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[640px] text-left text-sm sm:min-w-[720px]">{children}</table>
    </div>
  </div>
);

export const AdminTableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/40 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:from-white/[0.05] dark:to-transparent dark:text-gray-400">
    {children}
  </thead>
);

export const AdminTableRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="border-b border-gray-100 transition hover:bg-brand-500/[0.03] dark:border-gray-800/80 dark:hover:bg-white/[0.03]">
    {children}
  </tr>
);

export const AdminTh: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th className={cn('px-4 py-3.5 font-bold first:pl-5 last:pr-5 sm:px-5', className)}>{children}</th>
);

export const AdminTd: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className,
  style,
}) => (
  <td
    style={style}
    className={cn('px-4 py-3.5 text-gray-700 first:pl-5 last:pr-5 dark:text-gray-300 sm:px-5', className)}
  >
    {children}
  </td>
);

export const AdminPrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }
> = ({ icon, children, className, ...props }) => (
  <button
    type="button"
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/20 transition hover:shadow-lg hover:brightness-105 disabled:opacity-50',
      className
    )}
    {...props}
  >
    {icon ? <span className="material-symbols-outlined text-lg">{icon}</span> : null}
    {children}
  </button>
);

export const AdminGhostButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string }
> = ({ icon, children, className, ...props }) => (
  <button
    type="button"
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-400',
      className
    )}
    {...props}
  >
    {icon ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
    {children}
  </button>
);

export const AdminSecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className,
  ...props
}) => (
  <button
    type="button"
    className={cn(
      'inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-200',
      className
    )}
    {...props}
  >
    {children}
  </button>
);

interface AdminModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export const AdminModal: React.FC<AdminModalProps> = ({ title, subtitle, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div
      className={cn(
        TA_CARD,
        'max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-2xl',
        wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
      )}
    >
      <div className="relative flex items-start justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white px-5 py-4 dark:border-gray-800 dark:from-white/[0.04] dark:to-transparent sm:px-6">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-gray-200 p-1.5 text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">{children}</div>
      {footer ? (
        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02] sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  </div>
);

export const AdminFormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block text-theme-xs font-semibold text-gray-600 dark:text-gray-400">{children}</label>
);

export const AdminFilterChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition',
      active
        ? 'border-brand-500 bg-gradient-to-r from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-400'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400'
    )}
  >
    {children}
  </button>
);

export function orderStatusBadgeColor(status: string): 'warning' | 'primary' | 'success' | 'error' | 'light' {
  if (status === 'pending' || status === 'pending_payment') return 'warning';
  if (status === 'delivered' || status === 'confirmed') return 'success';
  if (status === 'cancelled' || status === 'failed') return 'error';
  if (status === 'paid') return 'success';
  if (status === 'refunded') return 'light';
  return 'primary';
}

export const StatusBadge: React.FC<{ label: string; status: string }> = ({ label, status }) => (
  <Badge color={orderStatusBadgeColor(status)}>{label}</Badge>
);

export const AdminProductThumb: React.FC<{ src?: string | null; alt?: string }> = ({ src, alt = '' }) =>
  src ? (
    <img src={src} alt={alt} className="size-10 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
  ) : (
    <span className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 ring-1 ring-gray-200 dark:bg-white/[0.05] dark:ring-gray-700">
      <span className="material-symbols-outlined text-base">image</span>
    </span>
  );

export const AdminRankBadge: React.FC<{ rank: number; highlight?: boolean }> = ({ rank, highlight }) => (
  <span
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
      highlight
        ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
        : 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-gray-300'
    )}
  >
    {rank}
  </span>
);

export const AdminInfoCard: React.FC<{
  label: string;
  children: React.ReactNode;
  icon?: string;
  tone?: StatTone;
  className?: string;
}> = ({ label, children, icon, tone = 'brand', className }) => {
  const theme = statThemes[tone];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/90 to-white p-4 shadow-sm dark:border-gray-800 dark:from-white/[0.04] dark:to-transparent',
        className
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-70', theme.bar)} />
      <div className="flex items-start gap-3">
        {icon ? (
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', theme.iconWrap)}>
            <span className={cn('material-symbols-outlined text-[18px]', theme.icon)}>{icon}</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

export const AdminStatusPill: React.FC<{
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition',
      active
        ? 'border-brand-500 bg-gradient-to-r from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-400'
        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-500/40 hover:bg-brand-500/[0.04] dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300',
      disabled && 'cursor-not-allowed opacity-50'
    )}
  >
    {children}
  </button>
);
