const { assignBrowseMuscleZone } = require('./exerciseMuscleBrowse');

function withBrowseMuscleZone(data) {
  return {
    ...data,
    browseMuscleZone: assignBrowseMuscleZone(data.primaryMuscles, data.name),
  };
}

module.exports = { withBrowseMuscleZone };
