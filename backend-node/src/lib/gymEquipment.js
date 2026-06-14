/**
 * Gym equipment maintenance date helpers.
 */

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeNextMaintenanceAt(fromDate, intervalDays) {
  const interval = Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 90;
  return addDays(fromDate, interval);
}

function completeMaintenanceUpdate(equipment, completedAt = new Date()) {
  const interval = equipment.maintenanceIntervalDays ?? 90;
  return {
    needsMaintenance: false,
    lastMaintenanceAt: completedAt,
    nextMaintenanceAt: computeNextMaintenanceAt(completedAt, interval),
  };
}

module.exports = {
  addDays,
  computeNextMaintenanceAt,
  completeMaintenanceUpdate,
};
