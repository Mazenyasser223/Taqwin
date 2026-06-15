import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useDebounce } from '../../../lib/hooks/useDebounce';
import adminShopService, { type AdminOrder } from '../../../services/adminShopService';
import type { OrderStatus, PaymentStatus } from '../../../types';
import {
  AdminAlert,
  AdminEmptyState,
  AdminGhostButton,
  AdminLoading,
  AdminPanel,
  AdminSecondaryButton,
  AdminTableHead,
  AdminTableRow,
  AdminTableWrap,
  AdminTd,
  AdminTh,
  StatusBadge,
  TA_INPUT,
  formatAdminPrice,
} from './adminShopUi';
import { AdminFilterSelect } from './AdminFilterSelect';
import { AdminPagination } from './AdminPagination';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'pending_payment',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];
const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

export const AdminOrdersPage: React.FC = () => {
  const { t, language } = useI18n();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>(
    (searchParams.get('status') as OrderStatus) || '',
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>(
    (searchParams.get('paymentStatus') as PaymentStatus) || '',
  );
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setStatusFilter((searchParams.get('status') as OrderStatus) || '');
    setPaymentFilter((searchParams.get('paymentStatus') as PaymentStatus) || '');
    setSearch(searchParams.get('search') ?? '');
    setPage(Number(searchParams.get('page')) || 1);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminShopService.getOrders({
      status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      search: debouncedSearch || undefined,
      page,
    });
    if (res.error) setError(res.error);
    else {
      setOrders(res.data?.items ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
      setTotal(res.data?.total ?? 0);
    }
    setLoading(false);
  }, [statusFilter, paymentFilter, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter, debouncedSearch]);

  const handleExport = async () => {
    setExporting(true);
    const res = await adminShopService.exportOrdersCsv({
      status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      search: debouncedSearch || undefined,
    });
    setExporting(false);
    if (res.error) setError(res.error);
  };

  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';

  return (
    <div className="space-y-6">
      <AdminPanel
        icon="receipt_long"
        accent="brand"
        title={t('adminShop.nav.orders')}
        subtitle={t('adminShop.orders.manageSub')}
        action={
          <AdminSecondaryButton disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? t('adminShop.exporting') : t('adminShop.exportCsv')}
          </AdminSecondaryButton>
        }
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('adminShop.orders.searchPlaceholder')}
            className={`${TA_INPUT} max-w-md`}
          />
          <div className="flex flex-wrap gap-3">
            <AdminFilterSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as OrderStatus | '')}
              allLabel={t('adminShop.orders.allStatuses')}
              options={ORDER_STATUSES.map((s) => ({
                value: s,
                label: t(`orders.status.${s}`),
              }))}
            />
            <AdminFilterSelect
              value={paymentFilter}
              onChange={(v) => setPaymentFilter(v as PaymentStatus | '')}
              allLabel={t('adminShop.orders.allPayments')}
              options={PAYMENT_STATUSES.map((s) => ({
                value: s,
                label: t(`orders.payment.${s}`),
              }))}
            />
          </div>
        </div>

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        {loading ? (
          <AdminLoading label={t('adminShop.loading')} />
        ) : orders.length === 0 ? (
          <AdminEmptyState icon="receipt_long" title={t('adminShop.orders.empty')} />
        ) : (
          <>
            <AdminTableWrap>
              <AdminTableHead>
                <AdminTableRow>
                  <AdminTh>{t('adminShop.orders.colId')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.colCustomer')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.colTotal')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.colStatus')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.colPayment')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.paymentReference')}</AdminTh>
                  <AdminTh>{t('adminShop.orders.colDate')}</AdminTh>
                  <AdminTh className="text-right">{t('adminShop.orders.colActions')}</AdminTh>
                </AdminTableRow>
              </AdminTableHead>
              <tbody>
                {orders.map((o) => (
                  <AdminTableRow key={o.id}>
                    <AdminTd className="font-mono text-theme-xs text-gray-500">#{o.id.slice(0, 8)}</AdminTd>
                    <AdminTd className="font-medium">{o.user?.email ?? '—'}</AdminTd>
                    <AdminTd className="font-bold tabular-nums">{formatAdminPrice(o.total, language)}</AdminTd>
                    <AdminTd>
                      <StatusBadge label={t(`orders.status.${o.status}`)} status={o.status} />
                    </AdminTd>
                    <AdminTd>
                      <StatusBadge
                        label={t(`orders.payment.${o.paymentStatus ?? 'pending'}`)}
                        status={o.paymentStatus ?? 'pending'}
                      />
                    </AdminTd>
                    <AdminTd className="max-w-[10rem] truncate font-mono text-theme-xs text-gray-500">
                      {o.paymentReference ?? '—'}
                    </AdminTd>
                    <AdminTd className="text-gray-500">{new Date(o.createdAt).toLocaleString(locale)}</AdminTd>
                    <AdminTd className="text-right">
                      <Link
                        to={`/admin/shop/orders/${o.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-theme-xs font-bold text-brand-500 transition hover:bg-brand-500/10"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        {t('adminShop.orders.view')}
                      </Link>
                    </AdminTd>
                  </AdminTableRow>
                ))}
              </tbody>
            </AdminTableWrap>
            <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </AdminPanel>
    </div>
  );
};
