import React, { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n/useI18n';
import { cn } from '../../../lib/cn';
import { TA_CARD, AdminLoading } from './adminShopUi';

const TABS = [
  { path: '/admin/shop', end: true, i18nKey: 'adminShop.nav.dashboard' as const, icon: 'dashboard' },
  { path: '/admin/shop/conversion-funnel', end: false, i18nKey: 'adminShop.nav.funnel' as const, icon: 'filter_alt' },
  { path: '/admin/shop/ai-commerce', end: false, i18nKey: 'adminShop.nav.aiCommerce' as const, icon: 'smart_toy' },
  { path: '/admin/shop/data-quality', end: false, i18nKey: 'adminShop.nav.dataQuality' as const, icon: 'fact_check' },
  { path: '/admin/shop/marketing', end: false, i18nKey: 'adminShop.nav.marketing' as const, icon: 'campaign' },
  { path: '/admin/shop/products', end: false, i18nKey: 'adminShop.nav.products' as const, icon: 'inventory_2' },
  { path: '/admin/shop/orders', end: false, i18nKey: 'adminShop.nav.orders' as const, icon: 'receipt_long' },
  { path: '/admin/shop/categories', end: false, i18nKey: 'adminShop.nav.categories' as const, icon: 'category' },
];

export const AdminShopLayout: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();

  return (
    <div className="admin-shop-shell mx-auto flex w-full min-w-0 flex-col gap-4 pb-6 text-base leading-normal sm:gap-6">
      <header className="min-w-0 px-0.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 sm:size-11">
            <span className="material-symbols-outlined text-xl text-brand-600 dark:text-brand-400 sm:text-2xl">
              storefront
            </span>
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {t('nav.adminShop')}
            </h1>
            <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{t('adminShop.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className={cn(TA_CARD, 'relative shrink-0 overflow-hidden shadow-sm')}>
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-brand-500 via-brand-400 to-emerald-500" />

        <nav
          className="flex gap-2 overflow-x-auto px-3 py-3 no-scrollbar snap-x snap-mandatory sm:flex-wrap sm:overflow-visible sm:px-4"
          aria-label={t('adminShop.navLabel')}
        >
          {TABS.map((tab) => {
            const isActive =
              tab.path === location.pathname ||
              (!tab.end && location.pathname.startsWith(tab.path));
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={cn(
                  'admin-shop-nav-link inline-flex shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all sm:px-4 sm:py-2.5',
                  isActive
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white'
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span className="admin-shop-nav-label whitespace-nowrap">{t(tab.i18nKey)}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="min-w-0">
        <Suspense fallback={<AdminLoading label={t('adminShop.loading')} />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};
