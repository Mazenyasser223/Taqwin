export type MuscleZone =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'glutes'

/** Sub-regions on the detailed Captain Hema model (each mesh → own hover color + exercise filter). */
export type FineMuscleRegion =
  | 'lats'
  | 'lowerback'
  | 'traps'
  | 'trapsmiddle'
  | 'frontshoulders'
  | 'rearshoulders'
  | 'hands'
  | 'abdominals'
  | 'obliques'

export type MuscleRegion = MuscleZone | FineMuscleRegion
