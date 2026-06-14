# Stripe Checkout (Taqwin Shop demo)

Real **test-mode** card payments with optional **auto-refund** after checkout.

## Setup

1. Create a [Stripe account](https://dashboard.stripe.com/register) (free).
2. Open **Developers → API keys** (Test mode).
3. Add to `backend-node/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # optional for local; see below
CHECKOUT_AUTO_REFUND=true         # default on in development
FRONTEND_URL=http://localhost:3000
```

4. Restart the backend.

When `STRIPE_SECRET_KEY` is set, **card** checkout uses Stripe instead of mock payment. Fawry/wallet/COD stay unchanged.

## Pay flow

1. Shop → Checkout → choose **Card**
2. On `/checkout/pay/:orderId` → **Continue to Stripe**
3. On Stripe hosted page use test card:

| Field | Value |
|-------|--------|
| Number | `4242 4242 4242 4242` |
| Expiry | any future date |
| CVC | any 3 digits |

**Do not use your real Visa card** — use Stripe test cards only.

4. After success → redirect to `/checkout/success` → backend syncs payment
5. If `CHECKOUT_AUTO_REFUND` is on → Stripe charges then **refunds automatically**

## Webhook (optional)

Success page calls `POST /orders/:id/stripe-sync` so webhooks are not required locally.

For production-like setup:

```bash
stripe listen --forward-to localhost:4002/api/marketplace/webhooks/stripe
```

Copy the `whsec_...` secret to `STRIPE_WEBHOOK_SECRET`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/marketplace/checkout/config` | `stripeEnabled`, test mode flags |
| POST | `/api/marketplace/orders/:id/stripe-session` | Create Checkout Session → `{ url }` |
| POST | `/api/marketplace/orders/:id/stripe-sync` | Finalize after redirect `{ sessionId }` |
| POST | `/api/marketplace/webhooks/stripe` | Stripe webhook (raw body) |

## Currency

Orders use **EGP** from the shop catalog. Stripe must support EGP on your account (test mode usually works).

## Disable Stripe

Remove `STRIPE_SECRET_KEY` — card payments fall back to mock checkout.
