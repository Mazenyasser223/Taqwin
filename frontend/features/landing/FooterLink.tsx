import React from 'react';
import { Link } from 'react-router-dom';
import type { FooterLinkItem } from './landingFooterContent';
import { useLandingAnchor } from './useLandingAnchor';
import { useI18n } from '../../lib/i18n/useI18n';

type Props = {
  item: FooterLinkItem;
  className?: string;
};

export function FooterLink({ item, className = '' }: Props) {
  const { t, isRtl } = useI18n();
  const scrollToAnchor = useLandingAnchor();
  const label = t(item.labelKey);
  const baseClass = `group flex w-full min-w-0 items-center gap-1.5 rounded-lg py-2 sm:py-1.5 text-xs sm:text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white ${className}`;
  const chevron = (
    <span
      className={`material-symbols-outlined text-base text-primary opacity-0 transition-all group-hover:opacity-100 ${
        isRtl ? '-translate-x-1 group-hover:translate-x-0' : 'translate-x-1 group-hover:translate-x-0'
      }`}
      aria-hidden
    >
      {isRtl ? 'chevron_left' : 'chevron_right'}
    </span>
  );

  if (item.anchor) {
    return (
      <button type="button" onClick={() => scrollToAnchor(item.href)} className={`text-start ${baseClass}`}>
        <span className="flex-1 min-w-0 leading-snug">{label}</span>
        {chevron}
      </button>
    );
  }

  if (item.external || item.href.startsWith('http') || item.href.startsWith('mailto:')) {
    return (
      <a
        href={item.href}
        target={item.href.startsWith('http') ? '_blank' : undefined}
        rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={baseClass}
      >
        <span className="flex-1 min-w-0 leading-snug">{label}</span>
        {chevron}
      </a>
    );
  }

  return (
    <Link to={item.href} className={baseClass}>
      <span className="flex-1 min-w-0 leading-snug">{label}</span>
      {chevron}
    </Link>
  );
}
