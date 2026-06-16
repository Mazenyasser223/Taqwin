# Shop Production Hardening Checklist

Use this checklist before and after every production release. Tick items weekly in staging, then verify in production.

---

## Performance

| Target | How to verify | Status |
|--------|---------------|--------|
| Product page **< 2 s** (LCP) | Lighthouse / WebPageTest on `/marketplace/product/:slug`; CDN for images | ☐ |
| Search **< 500 ms** | `GET /api/marketplace/products?search=` p95 in APM; DB indexes on name/brand | ☐ |
| Checkout **< 2 s** | Time from Pay click → Paymob redirect; minimize round-trips | ☐ |
| AI recommendations **cached** | Redis TTL 300s via `aiRecommendationsCache.js`; cache hit rate in logs | ☐ |

**Actions if slow:** enable Redis, add product list pagination limits, compress images, lazy-load gallery.

---

## Security

| Item | Implementation | Status |
|------|----------------|--------|
| **Rate limiting** | `funnelEventsLimiter` + `paymentsCreateLimiter` in `rateLimitApi.js` | ☑ |
| **Webhook signature validation** | Paymob HMAC in `marketplacePayments.js` → `verifyTransactionHmac` | ☑ |
| **Admin audit logs** | `admin_audit_logs` + `logAdminAction()` on product mutations | ☑ |
| **CSRF / CORS review** | Cookies `SameSite`; `FRONTEND_URL` allowlist; no `*` in production CORS | ☐ |

**Env:** `FUNNEL_RATE_LIMIT_MAX=40`, `PAYMENTS_CREATE_RATE_LIMIT_MAX=8`

**Weekly:** scan `.env` for secrets in git; rotate Paymob keys if webhook failures spike.

---

## Monitoring

| Item | Tool / location | Status |
|------|-----------------|--------|
| **Sentry** | Backend `SENTRY_DSN`; frontend `VITE_SENTRY_DSN`; cron + payment alerts | ☑ |
| **Uptime monitoring** | `GET /health` (503 if Postgres down), `GET /health/live`; `npm run uptime:ping` | ☑ |
| **Payment failure alerts** | `capturePaymentFailure` on Paymob webhook failure | ☑ |
| **Cron failure alerts** | `captureCronFailure` on internal cron routes + host scripts + pending-order scheduler | ☑ |

---

## Data Quality (review every week)

Admin → **Shop → Data Quality** (`/admin/shop/data-quality`)

- [ ] **Featured products** — image, stock > 0, correct category
- [ ] **Brands** — no empty brand strings; consistent spelling
- [ ] **Images** — every active product has `imageUrl`
- [ ] **Nutrition facts** — supplements have macros / serving info
- [ ] **Categories** — no empty categories; hierarchy makes sense

Target: **quality score ≥ 85/100**.

---

## Conversion Funnel

Admin → **Shop → Conversion Funnel** (`/admin/shop/conversion-funnel`)

```
Visitor → Search → Product View → Add To Cart → Checkout → Paid
```

Track drop-off between steps weekly. If **Search → Product View** is low, improve search relevance. If **Checkout → Paid** is low, check Paymob errors.

Client events: `frontend/lib/shopFunnel.ts` → `POST /api/marketplace/funnel/events`.

---

## Marketing Layer

Admin → **Shop → Marketing** (`/admin/shop/marketing`)

| Feature | Default codes / rules |
|---------|----------------------|
| **Coupons** | `WELCOME10`, `RAMADAN20`, `COACH15` |
| **Referral** | Invite friend → **100 points** each on first paid order |
| **Loyalty** | **1 point per 10 EGP** on paid orders; redeem 1:1 at checkout |

API: `/api/marketplace/marketing/*` (auth required).

---

## Pre-launch smoke test

1. Browse marketplace → product → add to cart → apply `WELCOME10` → checkout (Paymob test mode).
2. Confirm funnel counts increase in admin.
3. Confirm paid order earns loyalty points and redeems coupon.
4. Run `npm run seed:commerce-demo:force` on staging to populate demo funnel data.

---

*Last updated: 2026-06-15*
