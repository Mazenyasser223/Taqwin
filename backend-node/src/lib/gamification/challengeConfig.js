/**

 * Solo challenge catalog — metrics, targets, XP rewards.

 */



const CHALLENGE_TEMPLATES = [

  {

    slug: 'workout-7',

    durationDays: 7,

    metric: 'workout_days',

    target: 4,

    xpReward: 100,

    badgeSlug: 'challenge_workout_7',

    icon: 'fitness_center',

    sortOrder: 1,

  },

  {

    slug: 'hydration-7',

    durationDays: 7,

    metric: 'hydration_days',

    target: 5,

    xpReward: 80,

    badgeSlug: 'challenge_hydration_7',

    icon: 'water_drop',

    sortOrder: 2,

  },

  {

    slug: 'nutrition-14',

    durationDays: 14,

    metric: 'food_log_days',

    target: 10,

    xpReward: 120,

    badgeSlug: 'challenge_nutrition_14',

    icon: 'restaurant',

    sortOrder: 3,

  },

  {

    slug: 'score-7',

    durationDays: 7,

    metric: 'score_days',

    target: 5,

    xpReward: 100,

    badgeSlug: 'challenge_score_7',

    icon: 'bolt',

    sortOrder: 4,

  },

  {

    slug: 'gym-30',

    durationDays: 30,

    metric: 'gym_checkins',

    target: 8,

    xpReward: 150,

    badgeSlug: 'challenge_gym_30',

    icon: 'location_city',

    sortOrder: 5,

  },

  {

    slug: 'streak-7',

    durationDays: 7,

    metric: 'workout_streak',

    target: 5,

    xpReward: 120,

    badgeSlug: 'challenge_streak_7',

    icon: 'local_fire_department',

    sortOrder: 6,

  },

];



const CHALLENGE_TEMPLATES_BY_SLUG = Object.fromEntries(

  CHALLENGE_TEMPLATES.map((t) => [t.slug, t])

);



const ACTIVE_STATUSES = new Set(['active']);

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'abandoned']);



const SCORE_DAY_THRESHOLD = 60;

const HYDRATION_WATER_PTS_MIN = 20;

const HYDRATION_ML_MIN = 2000;

const FOOD_LOGS_PER_DAY_MIN = 2;



const XP_DUEL_WIN = 50;

const XP_DUEL_TIE = 25;

const XP_SQUAD_BONUS = 30;

const SQUAD_MIN_MEMBERS = 2;

const SQUAD_MAX_MEMBERS = 5;

const DUEL_ACHIEVEMENT_SLUG = 'challenge_duel_win';

/** Recompute challenge progress at most this often on read/list endpoints. */
const PROGRESS_REFRESH_TTL_MS = 5 * 60 * 1000;

function progressPct(progress, target) {

  if (!target || target <= 0) return 0;

  return Math.min(100, Math.round((progress / target) * 100));

}



function enumerateDateKeys(startDateKey, endDateKey) {

  const keys = [];

  const cursor = new Date(`${startDateKey}T12:00:00.000Z`);

  const end = new Date(`${endDateKey}T12:00:00.000Z`);

  while (cursor <= end) {

    keys.push(cursor.toISOString().slice(0, 10));

    cursor.setUTCDate(cursor.getUTCDate() + 1);

  }

  return keys;

}



function maxConsecutiveTrue(dateKeys, isTrue) {

  let best = 0;

  let run = 0;

  for (const key of dateKeys) {

    if (isTrue(key)) {

      run += 1;

      if (run > best) best = run;

    } else {

      run = 0;

    }

  }

  return best;

}



module.exports = {

  CHALLENGE_TEMPLATES,

  CHALLENGE_TEMPLATES_BY_SLUG,

  ACTIVE_STATUSES,

  TERMINAL_STATUSES,

  SCORE_DAY_THRESHOLD,

  HYDRATION_WATER_PTS_MIN,

  HYDRATION_ML_MIN,

  FOOD_LOGS_PER_DAY_MIN,

  XP_DUEL_WIN,

  XP_DUEL_TIE,

  XP_SQUAD_BONUS,

  SQUAD_MIN_MEMBERS,

  SQUAD_MAX_MEMBERS,

  DUEL_ACHIEVEMENT_SLUG,

  PROGRESS_REFRESH_TTL_MS,

  progressPct,

  enumerateDateKeys,

  maxConsecutiveTrue,

};


