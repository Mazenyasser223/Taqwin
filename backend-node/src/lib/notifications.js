/**
 * Notification helper — re-exports for backward compatibility.
 */
module.exports = {
  ...require('./notifications/notificationsCore'),
  ...require('./notifications/notificationConstants'),
  ...require('./notifications/fitnessNotify'),
};
