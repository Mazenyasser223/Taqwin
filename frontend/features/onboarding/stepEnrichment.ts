import type { OnboardingStep, StepOption } from './types';
import { ASSETS } from './onboardingAssets';
import { CARD_STEP_IDS } from './stepPresentation';

const BODY_FAT_PHOTOS = [
  ASSETS.bodyFat1,
  ASSETS.bodyFat2,
  ASSETS.bodyFat3,
  ASSETS.bodyFat4,
  ASSETS.bodyFat5,
  ASSETS.bodyFat6,
  ASSETS.bodyFat7,
];

/** Each option value → illustration that matches its meaning */
const OPTION_IMAGES: Record<string, Record<string, string>> = {
  primaryGoal: {
    'Build Muscle': ASSETS.goalMuscle,
    'Lose Weight': ASSETS.goalWeight,
    'Improve Endurance': ASSETS.goalEndurance,
    'Stay Healthy': ASSETS.goalWellness,
  },
  physique: {
    Lean: ASSETS.physiqueLean,
    Muscular: ASSETS.physiqueMuscular,
    Ripped: ASSETS.physiqueRipped,
  },
  bodyType: {
    ectomorph: ASSETS.bodyEctomorph,
    mesomorph: ASSETS.bodyMesomorph,
    endomorph: ASSETS.bodyEndomorph,
  },
  ageRange: {
    '18-29': ASSETS.age1829,
    '30-39': ASSETS.age3039,
    '40-49': ASSETS.age4049,
    '50+': ASSETS.age50plus,
  },
  fitnessLevel: {
    Beginner: ASSETS.levelBeginner,
    Intermediate: ASSETS.levelIntermediate,
    Advanced: ASSETS.levelAdvanced,
  },
  workoutLocation: {
    Home: ASSETS.workoutHome,
    Gym: ASSETS.workoutGym,
    Mixed: ASSETS.workoutMixed,
  },
  injuries: {
    none: ASSETS.injuryNone,
    neck: ASSETS.injuryNeck,
    shoulders: ASSETS.injuryShoulders,
    upper_back: ASSETS.injuryBack,
    lower_back: ASSETS.injuryBack,
    chest: ASSETS.injuryShoulders,
    arms: ASSETS.injuryArms,
    elbows: ASSETS.injuryElbows,
    wrists: ASSETS.injuryArms,
    hips: ASSETS.injuryLegs,
    knees: ASSETS.injuryKnees,
    ankles: ASSETS.injuryKnees,
    legs: ASSETS.injuryLegs,
    back: ASSETS.injuryBack,
  },
  pastTraining: {
    trainer: ASSETS.pastTrainer,
    apps: ASSETS.pastApps,
    videos: ASSETS.pastVideos,
    self: ASSETS.pastSelf,
    none: ASSETS.pastNone,
  },
  pushups: {
    lt12: ASSETS.pushFew,
    '13-20': ASSETS.pushMid,
    gt20: ASSETS.pushMany,
    unknown: ASSETS.default,
  },
  squats: {
    lt12: ASSETS.squatFew,
    '13-20': ASSETS.squatMid,
    gt20: ASSETS.squatMany,
    unknown: ASSETS.default,
  },
  addCardio: {
    yes: ASSETS.cardioYes,
    no: ASSETS.cardioNo,
  },
  workoutTime: {
    morning: ASSETS.timeMorning,
    afternoon: ASSETS.timeAfternoon,
    evening: ASSETS.timeEvening,
    varies: ASSETS.timeVaries,
  },
  workoutDuration: {
    '30': ASSETS.duration30,
    '45': ASSETS.duration45,
    '60': ASSETS.duration60,
    '90': ASSETS.duration90,
  },
  equipment: {
    treadmill: ASSETS.equipmentTreadmill,
    bike: ASSETS.equipmentBike,
    assault_bike: ASSETS.equipmentAssaultBike,
    elliptical: ASSETS.equipmentElliptical,
    stepper: ASSETS.equipmentStepper,
    rower: ASSETS.equipmentRower,
  },
  sleep: {
    lt5: ASSETS.sleepLt5,
    '5-6': ASSETS.sleep56,
    '7-8': ASSETS.sleep78,
    gt8: ASSETS.sleepGt8,
  },
  water: {
    coffee: ASSETS.waterCoffee,
    lt2: ASSETS.waterLt2,
    '2-6': ASSETS.waterMid,
    '7-10': ASSETS.waterHigh,
    gt10: ASSETS.waterHigh,
  },
  diet: {
    none: ASSETS.dietNone,
    vegetarian: ASSETS.dietVeg,
    gluten: ASSETS.dietGluten,
    lactose: ASSETS.dietLactose,
    nuts: ASSETS.dietNuts,
  },
  eatingHabits: {
    emotional: ASSETS.eatingEmotional,
    bored: ASSETS.eatingBored,
    unconscious: ASSETS.eatingUnconscious,
    habitual: ASSETS.eatingHabitual,
    energy: ASSETS.eatingEnergy,
  },
  walking: {
    lt1: ASSETS.walkLt1,
    '1-2': ASSETS.walk12,
    gt2: ASSETS.walkGt2,
  },
  exerciseAttitude: {
    necessary: ASSETS.exerciseNecessary,
    inconvenient: ASSETS.exerciseInconvenient,
    enjoyable: ASSETS.exerciseEnjoyable,
  },
  motivation: {
    visual: ASSETS.motivationVisual,
    fitness: ASSETS.motivationFitness,
    health: ASSETS.motivationHealth,
    clothing: ASSETS.motivationClothing,
    aging: ASSETS.motivationAging,
  },
  confidence: {
    high: ASSETS.confidenceHigh,
    reasonable: ASSETS.confidenceReasonable,
    optimistic: ASSETS.confidenceOptimistic,
    low: ASSETS.confidenceLow,
  },
  upcomingEvent: {
    vacation: ASSETS.eventVacation,
    wedding: ASSETS.eventWedding,
    birthday: ASSETS.eventBirthday,
    none: ASSETS.eventNone,
  },
  planFailed: {
    yes: ASSETS.planFailedYes,
    no: ASSETS.planFailedNo,
  },
  tracker: {
    yes: ASSETS.trackerYes,
    no: ASSETS.trackerNo,
  },
  otherSports: {
    cardio: ASSETS.sportCardio,
    other: ASSETS.sportOther,
    martial: ASSETS.sportMartial,
    team: ASSETS.sportTeam,
    none: ASSETS.sportNone,
  },
  pastActivities: {
    nutrition: ASSETS.activityNutrition,
    weights: ASSETS.activityWeights,
    cardio: ASSETS.activityCardio,
    bodyweight: ASSETS.activityBodyweight,
    sports: ASSETS.activitySports,
  },
  successMetrics: {
    muscle_gain: ASSETS.metricMuscle,
    strength: ASSETS.metricStrength,
    endurance: ASSETS.metricEndurance,
    weight_loss: ASSETS.metricWeightLoss,
    measurements: ASSETS.metricMeasurements,
    wellbeing: ASSETS.metricWellbeing,
  },
  bodyFocus: {
    full_body: ASSETS.focusFullBody,
    shoulders: ASSETS.focusShoulders,
    biceps: ASSETS.focusBiceps,
    back: ASSETS.focusBack,
    chest: ASSETS.focusChest,
    core: ASSETS.focusCore,
    glutes: ASSETS.focusGlutes,
    legs: ASSETS.focusLegs,
  },
  trackProgress: {
    heavier_weights: ASSETS.progressHeavier,
    milestones: ASSETS.progressMilestones,
    reps: ASSETS.progressReps,
    compounds: ASSETS.progressCompounds,
  },
  feelings: {
    energized: ASSETS.feelingEnergized,
    confident: ASSETS.feelingConfident,
    relaxed: ASSETS.feelingRelaxed,
    accomplished: ASSETS.feelingAccomplished,
  },
  stressCoping: {
    exercise: ASSETS.stressExercise,
    creative: ASSETS.stressCreative,
    outdoors: ASSETS.stressOutdoors,
    eating: ASSETS.stressEating,
  },
  pace: {
    fast: ASSETS.paceFast,
    steady: ASSETS.paceSteady,
    balanced: ASSETS.paceBalanced,
  },
};

function isPhotoAsset(url: string): boolean {
  return /\.(jpe?g|png|webp)(\?|$)/i.test(url);
}

function enrichOptions(stepId: string, options: StepOption[]): StepOption[] {
  const map = OPTION_IMAGES[stepId];
  return options.map(opt => {
    if (opt.icon) return { ...opt };
    const imageUrl = opt.imageUrl ?? map?.[opt.value];
    if (!imageUrl) return { ...opt };
    const isGender = stepId === 'gender';
    const photo = isPhotoAsset(imageUrl);
    return {
      ...opt,
      imageUrl,
      imageVariant:
        opt.imageVariant ??
        (isGender ? opt.imageVariant : photo ? ('photo' as const) : ('illustration' as const)),
    };
  });
}

/** Steps that show option illustrations in the chat UI */
const VISUAL_STEP_IDS = new Set([
  'ageRange',
  'gender',
  'bodyType',
  'primaryGoal',
  'physique',
  'fitnessLevel',
  'pastTraining',
  'pushups',
  'squats',
  'workoutLocation',
  'addCardio',
  'equipment',
  'workoutTime',
  'workoutDuration',
  'successMetrics',
  'trackProgress',
  'feelings',
  'pastActivities',
  'otherSports',
  'sleep',
  'water',
  'diet',
  'eatingHabits',
  'walking',
  'exerciseAttitude',
  'tracker',
  'planFailed',
  'motivation',
  'upcomingEvent',
  'confidence',
  'pace',
  'stressCoping',
]);

export function enrichStep(step: OnboardingStep): OnboardingStep {
  const presentation = CARD_STEP_IDS.has(step.id)
    ? ('card' as const)
    : step.presentation ?? ('chat' as const);

  if (step.type === 'single' || step.type === 'multi') {
    const enriched = enrichOptions(step.id, step.options);
    const hasImages = enriched.some(o => o.imageUrl && o.imageUrl !== ASSETS.default);
    const visual =
      step.visualOptions ??
      (VISUAL_STEP_IDS.has(step.id) ||
        step.id === 'gender' ||
        CARD_STEP_IDS.has(step.id) ||
        hasImages);
    return {
      ...step,
      presentation: step.presentation ?? presentation,
      visualOptions: visual,
      options: enriched,
    };
  }

  if (step.type === 'slider') {
    return {
      ...step,
      presentation: step.presentation ?? 'chat',
      levels: step.levels.map((l, i) => ({
        ...l,
        imageUrl: l.imageUrl ?? BODY_FAT_PHOTOS[i % BODY_FAT_PHOTOS.length],
      })),
    };
  }

  if (step.type === 'info' && step.id === 'goalProof') {
    return { ...step, variant: 'testimonials' as const, presentation: 'chat' };
  }

  if (step.type === 'number' || step.type === 'text' || step.type === 'likert') {
    return {
      ...step,
      presentation: step.presentation ?? 'chat',
    };
  }

  return step;
}
