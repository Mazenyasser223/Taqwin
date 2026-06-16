import React, { useCallback, useMemo, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { useI18n } from '../../../lib/i18n/useI18n';

import adminShopService, { type AdminOrder } from '../../../services/adminShopService';

import { invalidateAdminShopCache } from '../../../lib/adminShopCache';

import type { OrderStatus, PaymentStatus } from '../../../types';

import {

  AdminAlert,

  AdminGhostButton,

  AdminInfoCard,

  AdminListRow,

  AdminLoading,

  AdminPanel,

  AdminSecondaryButton,

  AdminStatusPill,

  formatAdminPrice,

  StatusBadge,

  TA_INPUT,

} from './adminShopUi';

import { buildOrderTimeline } from '../../orders/orderStatusTimeline';
import { OrderTimeline } from '../../orders/OrderTimeline';



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



export const AdminOrderDetailPage: React.FC = () => {

  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const { t, language } = useI18n();

  const [order, setOrder] = useState<AdminOrder | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [showShipForm, setShowShipForm] = useState(false);

  const [shipCarrier, setShipCarrier] = useState('');

  const [shipTracking, setShipTracking] = useState('');



  const load = useCallback(async () => {

    if (!id) return;

    setLoading(true);

    setError(null);

    const res = await adminShopService.getOrder(id);

    if (res.error) setError(res.error);

    else setOrder(res.data ?? null);

    setLoading(false);

  }, [id]);



  React.useEffect(() => {

    void load();

  }, [load]);



  const patchOrder = async (patch: {

    status?: OrderStatus;

    paymentStatus?: PaymentStatus;

    carrier?: string;

    trackingNumber?: string;

  }) => {

    if (!order) return;

    const previous = order;

    setOrder({ ...order, ...patch });

    setSaving(true);

    setError(null);

    const res = await adminShopService.updateOrderStatus(order.id, patch);

    setSaving(false);

    if (res.error) {

      setOrder(previous);

      setError(res.error);

      return;

    }

    setOrder(res.data ?? null);

    setShowShipForm(false);

    invalidateAdminShopCache('orders');

  };



  const handleStatusClick = (s: OrderStatus) => {

    if (s === 'shipped' && order?.status !== 'shipped') {

      setShipCarrier(order?.carrier ?? '');

      setShipTracking(order?.trackingNumber ?? '');

      setShowShipForm(true);

      return;

    }

    void patchOrder({ status: s });

  };



  const submitShipForm = () => {

    void patchOrder({

      status: 'shipped',

      carrier: shipCarrier.trim(),

      trackingNumber: shipTracking.trim(),

    });

  };



  const timeline = useMemo(() => {

    if (!order) return [];

    const steps = buildOrderTimeline(order);

    if (order.status === 'cancelled') {

      steps.push({

        key: 'cancelled',

        labelKey: 'adminShop.orders.timeline.cancelled',

        icon: 'cancel',

        done: true,

        at: order.updatedAt,

      });

    }

    return steps;

  }, [order]);



  if (loading) return <AdminLoading label={t('adminShop.loading')} />;

  if (!order) {

    return (

      <div className="space-y-4">

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        <AdminSecondaryButton onClick={() => navigate('/admin/shop/orders')}>

          {t('adminShop.orders.backToList')}

        </AdminSecondaryButton>

      </div>

    );

  }



  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale);



  return (

    <div className="space-y-6">

      <div className="flex flex-wrap items-center gap-3">

        <AdminGhostButton icon="arrow_back" onClick={() => navigate('/admin/shop/orders')}>

          {t('adminShop.orders.backToList')}

        </AdminGhostButton>

        <span className="font-mono text-sm text-gray-500">#{order.id}</span>

      </div>



      {error ? <AdminAlert>{error}</AdminAlert> : null}



      <AdminPanel

        icon="receipt_long"

        accent="brand"

        title={t('adminShop.orders.detailTitle')}

        subtitle={`#${order.id.slice(0, 8)}`}

        bodyClassName="space-y-6"

      >

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <AdminInfoCard label={t('adminShop.orders.colCustomer')} icon="person" tone="info">

            {order.user?.email ? (

              <Link

                to={`/community/profile/${order.user.id}`}

                className="font-semibold text-brand-500 hover:underline"

              >

                {order.user.email}

              </Link>

            ) : (

              <p className="font-semibold text-gray-900 dark:text-white">—</p>

            )}

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.colTotal')} icon="payments" tone="success">

            <p className="text-xl font-bold text-gray-900 dark:text-white">

              {formatAdminPrice(order.total, language)}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.colDate')} icon="schedule" tone="brand">

            <p className="font-semibold text-gray-900 dark:text-white">{fmt(order.createdAt)}</p>

          </AdminInfoCard>

        </div>



        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <AdminInfoCard label={t('adminShop.orders.paymentProvider')} icon="account_balance" tone="info">

            <p className="font-semibold text-gray-900 dark:text-white">

              {order.paymentProvider ?? '—'}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.paymentReference')} icon="tag" tone="warning">

            <p className="break-all font-mono text-sm font-semibold text-gray-900 dark:text-white">

              {order.paymentReference ?? '—'}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.paidAt')} icon="event_available" tone="success">

            <p className="font-semibold text-gray-900 dark:text-white">

              {order.paidAt ? fmt(order.paidAt) : '—'}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.colPayment')} icon="credit_card" tone="brand">

            <StatusBadge

              label={t(`orders.payment.${order.paymentStatus ?? 'pending'}`)}

              status={order.paymentStatus ?? 'pending'}

            />

          </AdminInfoCard>

        </div>



        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <AdminInfoCard label={t('adminShop.orders.carrier')} icon="local_shipping" tone="info">

            <p className="font-semibold text-gray-900 dark:text-white">{order.carrier ?? '—'}</p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.trackingNumber')} icon="qr_code_2" tone="warning">

            <p className="break-all font-mono text-sm font-semibold text-gray-900 dark:text-white">

              {order.trackingNumber ?? '—'}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.shippedAt')} icon="flight_takeoff" tone="brand">

            <p className="font-semibold text-gray-900 dark:text-white">

              {order.shippedAt ? fmt(order.shippedAt) : '—'}

            </p>

          </AdminInfoCard>

          <AdminInfoCard label={t('adminShop.orders.deliveredAt')} icon="inventory_2" tone="success">

            <p className="font-semibold text-gray-900 dark:text-white">

              {order.deliveredAt ? fmt(order.deliveredAt) : '—'}

            </p>

          </AdminInfoCard>

        </div>



        <div className="space-y-2">

          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

            {t('adminShop.orders.changeStatus')}

          </p>

          <div className="flex flex-wrap gap-2">

            {ORDER_STATUSES.map((s) => (

              <AdminStatusPill

                key={s}

                active={order.status === s}

                disabled={saving || order.status === s}

                onClick={() => handleStatusClick(s)}

              >

                {t(`orders.status.${s}`)}

              </AdminStatusPill>

            ))}

          </div>

        </div>



        {showShipForm ? (

          <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-4">

            <p className="text-sm font-bold text-gray-900 dark:text-white">

              {t('adminShop.orders.shipForm.title')}

            </p>

            <div className="grid gap-4 sm:grid-cols-2">

              <label className="space-y-1.5">

                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

                  {t('adminShop.orders.carrier')}

                </span>

                <input

                  type="text"

                  className={TA_INPUT}

                  value={shipCarrier}

                  onChange={(e) => setShipCarrier(e.target.value)}

                  placeholder="Bosta"

                />

              </label>

              <label className="space-y-1.5">

                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

                  {t('adminShop.orders.trackingNumber')}

                </span>

                <input

                  type="text"

                  className={TA_INPUT}

                  value={shipTracking}

                  onChange={(e) => setShipTracking(e.target.value)}

                  placeholder="ABC123"

                />

              </label>

            </div>

            <div className="flex flex-wrap gap-2">

              <AdminSecondaryButton disabled={saving} onClick={submitShipForm}>

                {t('adminShop.orders.shipForm.save')}

              </AdminSecondaryButton>

              <AdminGhostButton disabled={saving} onClick={() => setShowShipForm(false)}>

                {t('adminShop.orders.shipForm.cancel')}

              </AdminGhostButton>

            </div>

          </div>

        ) : null}



        <div className="space-y-2">

          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

            {t('adminShop.orders.changePayment')}

          </p>

          <div className="flex flex-wrap gap-2">

            {PAYMENT_STATUSES.map((s) => (

              <AdminStatusPill

                key={s}

                active={order.paymentStatus === s}

                disabled={saving || order.paymentStatus === s}

                onClick={() => patchOrder({ paymentStatus: s })}

              >

                {t(`orders.payment.${s}`)}

              </AdminStatusPill>

            ))}

          </div>

        </div>



        <div className="grid gap-6 lg:grid-cols-2">

          <div className="space-y-2">

            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

              {t('adminShop.orders.items')}

            </p>

            <ul className="space-y-2">

              {(order.items ?? []).map((item) => (

                <AdminListRow key={item.id}>

                  <span className="text-sm font-medium text-gray-800 dark:text-white/90">

                    {item.product?.name ?? item.productId} × {item.quantity}

                  </span>

                  <span className="font-bold tabular-nums text-gray-900 dark:text-white">

                    {formatAdminPrice(item.unitPrice * item.quantity, language)}

                  </span>

                </AdminListRow>

              ))}

            </ul>

          </div>



          <div className="space-y-2">

            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">

              {t('adminShop.orders.timeline.title')}

            </p>

            <OrderTimeline

              steps={timeline.map((step) => ({

                ...step,

                labelKey:

                  step.key === 'placed'

                    ? 'adminShop.orders.timeline.placed'

                    : step.key === 'paid'

                      ? 'adminShop.orders.timeline.paid'

                      : step.key === 'confirmed'

                        ? 'adminShop.orders.timeline.confirmed'

                        : step.key === 'processing'

                          ? 'adminShop.orders.timeline.processing'

                          : step.key === 'packed'

                            ? 'adminShop.orders.timeline.packed'

                            : step.key === 'shipped'

                              ? 'adminShop.orders.timeline.shipped'

                              : step.key === 'delivered'

                                ? 'adminShop.orders.timeline.delivered'

                                : step.labelKey,

              }))}

              variant="admin"

            />

          </div>

        </div>

      </AdminPanel>

    </div>

  );

};

