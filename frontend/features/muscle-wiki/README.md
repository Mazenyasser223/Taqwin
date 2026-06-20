# Captain Hema Muscle Wiki

Interactive 3D muscle explorer for Taqwin athletes. Part of the frontend feature module at `features/muscle-wiki/`.

For live push-up and squat form analysis, see the separate **Cap Hema Eye** module at `features/cap-hema-eye/` (`#/cap-hema-eye`).

## 3D model asset

Place your Blender export at:

```text
frontend/public/captain_hema_fixed_final2.glb
```

The canvas loads it from `/captain_hema_fixed_final2.glb`. Without this file, the page renders but the 3D model will not appear.

## Feature files

```text
features/muscle-wiki/
├── README.md                          # This file
├── MuscleWikiPage.tsx                 # Page entry (lazy-loaded from App.tsx)
├── muscleRegions.ts                   # Muscle zone definitions
├── muscleExercises.ts                 # Exercise lookup by muscle
├── muscleCamera.ts                    # Camera presets and transitions
├── muscleWikiCount.ts                 # Exercise count helpers
├── useMuscleExerciseCounts.ts         # Hook for per-muscle counts
├── wikiRegionLibraryMuscle.ts         # Region ↔ library muscle mapping
├── muscleFeaturedExercises.generated.ts
├── muscleWikiRevealStorage.ts         # First-visit reveal state
├── types.ts
├── components/
│   ├── CaptainHemaCanvas.tsx          # Three.js canvas + GLB loader
│   ├── CaptainHemaFirstVisitReveal.tsx
│   ├── MuscleZonePicker.tsx           # Zone selection UI
│   ├── ExercisePanel.tsx              # Linked exercises for selected muscle
│   └── CanvasErrorBoundary.tsx
└── *.test.ts                          # Unit tests (counts, region mapping)
```

## Route

- Hash route: `#/muscle-wiki`
- Requires authentication (protected route)

## Backend integration

- Exercise catalog API: `backend-node/src/routes/exercises.js`
- MuscleWiki import: `npm run import:musclewiki --prefix backend-node`
- Featured exercise generation: `npm run generate:musclewiki-featured --prefix backend-node`
- Exercise category covers: `frontend/public/workouts/categories/` (see [README](../../public/workouts/categories/README.md))

## Related

- **Cap Hema Eye** (live form analysis): `features/cap-hema-eye/CapHemaEyePage.tsx`
- Frontend overview: [../../README.md](../../README.md)
