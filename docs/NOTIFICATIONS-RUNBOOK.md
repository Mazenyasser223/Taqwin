# Notifications v2 — Ops Runbook

Operational guide for deploying, verifying, and rolling back the notification system (grouping, quiet hours, rate limits, hardening).

---

## 1. Migration commands

From repo root:

```bash
cd backend-node

# Preview pending migrations (optional)
npx prisma migrate status

# Apply all pending migrations (production)
npx prisma migrate deploy

# Regenerate client after schema change (local/CI)
npx prisma generate
```

**Migrations involved:**

| Migration | Purpose |
|-----------|---------|
| `20260718120000_notifications_v2` | Core v2 fields, pending/snooze/events tables |
| `20260718140000_notifications_hardening` | Inbox index, emit counters, partial dedupe index |

**Verify schema:**

```bash
node scripts/check-db-schema.js
```

---

## 2. Backfill (legacy rows)

Always dry-run first:

```bash
cd backend-node
node scripts/backfill-notifications-v2.js --dry-run
node scripts/backfill-notifications-v2.js --limit=10000
node scripts/backfill-notifications-v2.js
```

Backfill sets on old rows:

- `category`, `priority`, `schemaVersion`, `icon`
- `readAt` when `read = true` but `readAt` is null

---

## 3. Load test (grouping / race safety)

Requires a live database (`DATABASE_URL` in `.env`):

```bash
cd backend-node
node scripts/load-test-notification-grouping.js
```

Optional env:

```bash
REACTIONS=1000 POST_ID=<uuid> node scripts/load-test-notification-grouping.js
```

**Pass criteria:**

- `rowCount === 1`
- `actorCount === REACTIONS`
- `ok: true`

Unit tests (no DB):

```bash
npm test -- tests/notificationGrouping.test.js
```

---

## 4. Important environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | — | Required for migrations and runtime |
| `AI_INTERNAL_KEY` | — | Required for `/api/internal/notifications/health` |
| `FEATURE_NOTIFICATION_MAINTENANCE` | `true` in production | Expire / archive / flush pending queue |
| `NOTIFICATION_MAINTENANCE_INTERVAL_MS` | `3600000` | Maintenance cron interval |
| `NOTIFICATION_METRICS_FLUSH_MS` | `300000` | Log in-process counters every 5 min |
| `FEATURE_SMART_NOTIFY_CRON` | off unless `true` | Workout/meal reminders |
| `SMART_NOTIFY_CRON_INTERVAL_MS` | `3600000` | Smart notify tick |
| `SMART_NOTIFY_WORKOUT_HOUR` | `17` | Local hour for workout reminder |

User settings (via API / UI):

- `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd`
- `digestNotifications`
- `notifyWorkoutReminders`, `notifyAiSuggestions`, `notifyPromotional`

---

## 5. Health checks

### Internal ops (cron / monitoring)

```bash
curl -s -H "X-Internal-Key: $AI_INTERNAL_KEY" \
  http://localhost:4000/api/internal/notifications/health | jq
```

### Platform admin (JWT + `admin` role)

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  http://localhost:4000/api/admin/notifications/health | jq
```

**Response fields:**

```json
{
  "metrics": {
    "created": 0,
    "grouped": 0,
    "deduped": 0,
    "quietHoursPending": 0,
    "rateLimited": 0,
    "publishFailed": 0,
    "groupRaceRetries": 0
  },
  "queues": {
    "pendingTotal": 0,
    "pendingDueNow": 0,
    "snoozedActive": 0,
    "expiredAwaitingCleanup": 0,
    "archivedTotal": 0
  }
}
```

**Log stream:** search for `notification emit metrics` or `notification health probe`.

**Alerts (suggested):**

- `queues.pendingDueNow > 100` for > 15 min
- `metrics.publishFailed` spike after deploy
- `metrics.groupRaceRetries` sustained high (grouping contention)
- `metrics.rateLimited` spike (possible abuse)

---

## 6. Rollback notes

Prisma migrations are **forward-only** in production. Rollback strategy:

1. **App rollback:** redeploy previous backend build (old code may ignore new columns; safe if columns are additive).
2. **Do not** drop new tables/columns unless you have a written down-migration and maintenance window.
3. **Disable new behaviour quickly:**
   - Set `FEATURE_NOTIFICATION_MAINTENANCE=false`
   - Set `FEATURE_SMART_NOTIFY_CRON=false`
4. **Rate limits:** restart clears in-memory metrics only; DB counters in `notification_emit_counters` persist until TTL windows expire (hour/day keys).
5. **Bad grouping data:** soft-delete affected rows (`deletedAt`) or run targeted cleanup by `group_key`.

If a migration fails mid-way, fix SQL manually, then:

```bash
npx prisma migrate resolve --applied 20260718140000_notifications_hardening
```

---

## 7. Manual QA checklist

Use two browsers/devices logged in as the same user.

### Grouping

- [ ] 100 likes on one post → **one** notification, message like “Ahmed and N others liked your post”
- [ ] `actorCount` increases; drawer shows ×N badge when > 1
- [ ] Multiple comments on same post → grouped “N new comments…”

### Multi-device sync

- [ ] Mark read on **phone** → unread badge clears on **web** within seconds (WebSocket open)
- [ ] Mark all read on one device → all devices clear
- [ ] Delete notification on one device → removed on others

### Quiet hours

- [ ] Enable DND 22:00–08:00 in Settings
- [ ] Trigger LOW/NORMAL notification (e.g. promo/reaction) during quiet window → **not** delivered immediately
- [ ] After window ends (or maintenance flush) → pending items delivered
- [ ] URGENT/HIGH (e.g. support reply, follow request) still deliver during DND

### Snooze

- [ ] Workout/meal reminder shows Snooze actions
- [ ] Snooze 15m → notification hidden until window passes
- [ ] After snooze expires → notification reappears on refresh

### Inbox UX

- [ ] Filter tabs: All / Unread / Social / Workout / AI / Orders / Support
- [ ] Cursor scroll loads more without **duplicate** rows
- [ ] Opening drawer marks items **seen** (`seenAt`); clicking marks **read** (`readAt`)

### Actions

- [ ] Follow request → Accept/Decline from notification card
- [ ] Group invite → Accept/Decline
- [ ] Actions use backend `actions[]` payload (not hardcoded type checks only)

---

## 8. Close-out checklist (before marking done)

- [ ] `npx prisma migrate deploy` on staging + production
- [ ] `backfill --dry-run` then full backfill
- [ ] `load-test-notification-grouping.js` passes
- [ ] Health endpoint returns 200 with expected shape
- [ ] Manual QA checklist signed off
- [ ] `npm test` green (373+ tests)

---

## Quick reference

```bash
# Full deploy sequence
cd backend-node
npx prisma migrate deploy
node scripts/backfill-notifications-v2.js --dry-run
node scripts/backfill-notifications-v2.js
node scripts/load-test-notification-grouping.js
npm test
curl -H "X-Internal-Key: $AI_INTERNAL_KEY" localhost:4000/api/internal/notifications/health
```
