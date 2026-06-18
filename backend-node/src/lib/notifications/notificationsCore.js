/**
 * Core notification emit/upsert — grouping, idempotency, templates, quiet hours.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { getOrCreateUserSettings } = require('../userSettings');
const {
  SCHEMA_VERSION,
  GROUPABLE_TYPES,
  COLLAPSIBLE_TYPES,
  categoryForType,
  priorityForType,
  iconForType,
  expiryDateForType,
  buildGroupKey,
  buildDedupeKey,
} = require('./notificationConstants');
const { renderNotification } = require('./notificationTemplates');
const { actionsForType } = require('./notificationActions');
const { shouldDefer, nextQuietHoursEnd, queuePendingNotification } = require('./notificationQuietHours');
const { upsertWithGroupLock, mergeActorFields } = require('./notificationGrouping');
const { acquireEmitSlot } = require('./notificationEmitCounter');
const { inc } = require('./notificationMetrics');

/** In-app opt-out: marketing promos only. All other types always appear in the drawer. */
const IN_APP_PREF_BY_PREFIX = [{ prefix: 'promo.', pref: 'notifyPromotional' }];

function inAppPrefKeyForType(type) {
  if (!type) return null;
  for (const row of IN_APP_PREF_BY_PREFIX) {
    if (type.startsWith(row.prefix)) return row.pref;
  }
  return null;
}

async function shouldCreateInAppNotification(userId, type) {
  const prefKey = inAppPrefKeyForType(type);
  if (!prefKey) return true;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) return true;
  return Boolean(settings[prefKey]);
}

function mergeActor(actors, actor) {
  const list = Array.isArray(actors) ? [...actors] : [];
  if (!actor?.id) return list;
  const filtered = list.filter((a) => a.id !== actor.id);
  filtered.unshift(actor);
  return filtered.slice(0, 3);
}

function actorFromOpts(opts) {
  if (!opts.actorId) return null;
  return {
    id: opts.actorId,
    displayName: opts.actorDisplayName || 'Someone',
    avatarUrl: opts.actorAvatarUrl || null,
  };
}

function resolveNotificationCopy(type, renderPayload, lang, opts = {}) {
  const { title: titleOverride, message: messageOverride, _allowCopyOverride = false, userId } = opts;
  const hasTitle = titleOverride != null && String(titleOverride).trim() !== '';
  const hasMessage = messageOverride != null && String(messageOverride).trim() !== '';

  if (hasTitle && hasMessage) {
    if (!_allowCopyOverride) {
      logger.warn(
        { type, userId },
        'Notification used title/message override — prefer type + payload + templates',
      );
    }
    return { title: titleOverride, message: messageOverride };
  }

  if ((hasTitle || hasMessage) && !_allowCopyOverride) {
    logger.warn(
      { type, userId, hasTitle, hasMessage },
      'Notification used partial title/message override — ignored; using templates',
    );
  }

  return renderNotification(type, renderPayload, lang);
}

function buildRenderPayload(type, payload, actors, actorCount, collapsedCount, opts) {
  const base = { ...(payload || {}) };
  if (actors?.length) {
    base.actors = actors;
    base.actorName = actors[0]?.displayName || opts.actorDisplayName;
  } else if (opts.actorDisplayName) {
    base.actorName = opts.actorDisplayName;
  }
  base.actorCount = actorCount;
  base.collapsedCount = collapsedCount;
  return base;
}

async function pushNotificationRealtime(userId, row, eventType = 'notification.new') {
  try {
    const {
      pushRealtime,
      notificationEnvelope,
      notificationUpdatedEnvelope,
    } = require('../../realtime/publish');
    const envelope =
      eventType === 'notification.updated' ? notificationUpdatedEnvelope(row) : notificationEnvelope(row);
    await pushRealtime(userId, envelope);
  } catch (err) {
    inc('publishFailed');
    logger.warn({ err: err?.message, userId, notificationId: row?.id }, 'notification publish failed');
  }
}

function deliverTelegramIfNew(userId, row, isNew = true) {
  if (!row || !isNew) return;
  const { maybeSendTelegram } = require('../telegram/telegramDelivery');
  void maybeSendTelegram(userId, row).catch((err) => {
    logger.warn({ err: err?.message, userId, type: row?.type }, 'telegram side-effect failed');
  });
}

function mapRawRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id,
    actorCount: Number(row.actor_count ?? row.actorCount ?? 1),
    collapsedCount: Number(row.collapsed_count ?? row.collapsedCount ?? 1),
    actorIds: row.actor_ids ?? row.actorIds,
    payload: row.payload,
    groupKey: row.group_key ?? row.groupKey,
    link: row.link,
    readAt: row.read_at ?? row.readAt,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

async function enrichGroupedRow(bumped, opts, type, lang) {
  const {
    title: titleOverride,
    message: messageOverride,
    link,
    actorId,
    actorDisplayName,
    actorAvatarUrl,
    payload = {},
  } = opts;

  const row = mapRawRow(bumped);
  const newActor = actorFromOpts(opts);
  const prevActors = Array.isArray(row.actorIds) ? row.actorIds : [];
  const actors = mergeActor(prevActors, newActor);
  const actorCount = row.actorCount;
  const collapsedCount = row.collapsedCount;

  let collapsedItems = payload.collapsedItems || [];
  if (COLLAPSIBLE_TYPES.has(type)) {
    collapsedItems = [
      ...(Array.isArray(row.payload?.collapsedItems) ? row.payload.collapsedItems : []),
      { link, preview: payload.preview || null, at: new Date().toISOString() },
    ];
  }

  const renderPayload = buildRenderPayload(
    type,
    { ...payload, collapsedItems },
    actors,
    actorCount,
    collapsedCount,
    opts,
  );
  const rendered = resolveNotificationCopy(type, renderPayload, lang, { ...opts, userId: bumped.user_id ?? bumped.userId });

  const withActors = await mergeActorFields(row.id, actors, actorId, actorDisplayName, actorAvatarUrl, link);

  return prisma.notification.update({
    where: { id: row.id },
    data: {
      payload: renderPayload,
      title: rendered.title,
      message: rendered.message,
      link: link || withActors.link,
    },
  });
}

/**
 * Internal emit — full feature set.
 */
async function emitNotificationInternal(opts) {
  const {
    userId,
    type,
    title: titleOverride,
    message: messageOverride,
    link,
    actorId,
    actorDisplayName,
    actorAvatarUrl,
    payload = {},
    groupKey: groupKeyOverride,
    dedupeKey: dedupeKeyOverride,
    priority: priorityOverride,
    category: categoryOverride,
    actions: actionsOverride,
    icon: iconOverride,
    imageUrl,
    expiresAt: expiresAtOverride,
    _skipQuietHours = false,
    _skipRateLimit = false,
    _allowCopyOverride = false,
  } = opts;

  if (!userId || !type) return null;

  const allowed = await shouldCreateInAppNotification(userId, type);
  if (!allowed) return null;

  if (!_skipRateLimit) {
    const slotOk = await acquireEmitSlot(userId, type);
    if (!slotOk) return null;
  }

  const settings = await getOrCreateUserSettings(userId);
  const lang = settings.language === 'ar' ? 'ar' : 'en';
  const category = categoryOverride || categoryForType(type);
  const priority = priorityOverride || priorityForType(type);
  const icon = iconOverride || iconForType(type);
  const expiresAt = expiresAtOverride ?? expiryDateForType(type);
  const groupKey = groupKeyOverride ?? buildGroupKey(type, { ...payload, userId });
  const dedupeKey = dedupeKeyOverride ?? buildDedupeKey(userId, type, { ...payload, userId });
  const actions = actionsForType(type, actionsOverride);
  const newActor = actorFromOpts(opts);

  if (!_skipQuietHours && shouldDefer(priority, settings)) {
    await queuePendingNotification(userId, opts, nextQuietHoursEnd(settings));
    inc('quietHoursPending');
    return null;
  }

  if (dedupeKey) {
    const existing = await prisma.notification.findUnique({ where: { dedupeKey } });
    if (existing && !existing.deletedAt) {
      inc('deduped');
      return existing;
    }
  }

  const createRow = async () => {
    const actors = newActor ? [newActor] : [];
    const actorCount = newActor ? 1 : 1;
    const collapsedCount = 1;
    const collapsedItems = payload.collapsedItems || [];
    const renderPayload = buildRenderPayload(
      type,
      { ...payload, collapsedItems },
      actors,
      actorCount,
      collapsedCount,
      opts,
    );
    const rendered = resolveNotificationCopy(type, renderPayload, lang, {
      title: titleOverride,
      message: messageOverride,
      _allowCopyOverride,
      userId,
    });

    if (!rendered.title || !rendered.message) return null;

    return prisma.notification.create({
      data: {
        userId,
        type,
        title: rendered.title,
        message: rendered.message,
        link: link || null,
        category,
        priority,
        payload: renderPayload,
        groupKey,
        actorIds: actors.length ? actors : undefined,
        actorCount,
        actions: actions.length ? actions : undefined,
        icon,
        imageUrl: imageUrl || null,
        schemaVersion: SCHEMA_VERSION,
        dedupeKey,
        collapsedCount,
        actorId: actors[0]?.id || actorId || null,
        actorDisplayName: actors[0]?.displayName || actorDisplayName || null,
        actorAvatarUrl: actors[0]?.avatarUrl || actorAvatarUrl || null,
        expiresAt,
      },
    });
  };

  let row;
  if (groupKey) {
    const result = await upsertWithGroupLock({
      userId,
      groupKey,
      type,
      incrementActor: Boolean(newActor),
      incrementCollapse: COLLAPSIBLE_TYPES.has(type),
      createFn: createRow,
      mergeFn: (bumped) => enrichGroupedRow(bumped, opts, type, lang),
    });
    row = result?.row;
    if (row) {
      await pushNotificationRealtime(
        userId,
        row,
        result.isNew ? 'notification.new' : 'notification.updated',
      );
      await deliverTelegramIfNew(userId, row, result.isNew);
    }
    return row;
  }

  try {
    row = await createRow();
    if (row) {
      inc('created');
      await pushNotificationRealtime(userId, row, 'notification.new');
      await deliverTelegramIfNew(userId, row, true);
    }
    return row;
  } catch (err) {
    if (dedupeKey && err?.code === 'P2002') {
      inc('deduped');
      return prisma.notification.findUnique({ where: { dedupeKey } });
    }
    logger.warn({ err, userId, type }, 'Failed to emit notification');
    return null;
  }
}

async function emitNotification(opts) {
  return emitNotificationInternal(opts);
}

async function emitNotificationBatch(items, opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  if (dryRun) return { created: 0, skipped: items.length };

  let created = 0;
  let skipped = 0;
  for (const item of items) {
    const row = await emitNotificationInternal(item);
    if (row) created += 1;
    else skipped += 1;
  }
  return { created, skipped };
}

async function snoozeNotification(notificationId, userId, until) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notif || notif.userId !== userId) return null;

  const { randomUUID } = require('crypto');
  await prisma.notificationSnooze.create({
    data: { id: randomUUID(), userId, notificationId, snoozedUntil: until },
  });

  return prisma.notification.update({
    where: { id: notificationId },
    data: { snoozedUntil: until },
  });
}

module.exports = {
  emitNotification,
  emitNotificationInternal,
  emitNotificationBatch,
  shouldCreateInAppNotification,
  inAppPrefKeyForType,
  snoozeNotification,
  mapRawRow,
};
