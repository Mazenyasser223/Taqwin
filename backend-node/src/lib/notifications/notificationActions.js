/**
 * Default inline actions per notification type.
 * Labels are localization keys resolved in serialize layer.
 */

const ACTION_DEFS = {
  'community.follow_request': [
    { label: 'Accept', labelKey: 'community.accept', action: 'follow.accept', style: 'primary' },
    { label: 'Decline', labelKey: 'community.decline', action: 'follow.decline', style: 'secondary' },
  ],
  'community.group_invite': [
    { label: 'Accept', labelKey: 'community.accept', action: 'group.invite.accept', style: 'primary' },
    { label: 'Decline', labelKey: 'community.decline', action: 'group.invite.decline', style: 'secondary' },
  ],
  'community.group_join_request': [
    { label: 'Accept', labelKey: 'community.accept', action: 'group.join.accept', style: 'primary' },
    { label: 'Decline', labelKey: 'community.decline', action: 'group.join.decline', style: 'secondary' },
  ],
  'workout.reminder': [
    { label: 'Snooze 15m', labelKey: 'notifications.snooze15', action: 'snooze.15m', style: 'secondary' },
    { label: 'Snooze 1h', labelKey: 'notifications.snooze1h', action: 'snooze.1h', style: 'secondary' },
  ],
  'plan.meal_reminder': [
    { label: 'Snooze 15m', labelKey: 'notifications.snooze15', action: 'snooze.15m', style: 'secondary' },
    { label: 'Tomorrow', labelKey: 'notifications.snoozeTomorrow', action: 'snooze.tomorrow', style: 'secondary' },
  ],
};

function actionsForType(type, override) {
  if (Array.isArray(override)) return override;
  return ACTION_DEFS[type] || [];
}

module.exports = { actionsForType, ACTION_DEFS };
