const { assignBrowseMuscleZone } = require('./exerciseMuscleBrowse');
const { classifyExerciseFitnessGoals } = require('./exerciseFitnessGoals');

function withBrowseMuscleZone(data) {
  return {
    ...data,
    browseMuscleZone: assignBrowseMuscleZone(data.primaryMuscles, data.name),
    fitnessGoals: classifyExerciseFitnessGoals(data),
  };
}

module.exports = { withBrowseMuscleZone };
