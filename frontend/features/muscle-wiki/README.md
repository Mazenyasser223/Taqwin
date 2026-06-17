# Captain Hema Muscle Wiki

Interactive 3D muscle explorer for Taqwin athletes. Part of the frontend feature module at `features/muscle-wiki/`.

## 3D model asset

Place your Blender export at:

```text
frontend/public/captain_hema_fixed_final2.glb
```

The canvas loads it from `/captain_hema_fixed_final2.glb`. Without this file, the page renders but the 3D model will not appear.

## Feature files

```text
features/muscle-wiki/
├── README.md              # This file
├── MuscleWikiPage.tsx     # Page entry (lazy-loaded from App.tsx)
└── …                      # Canvas, muscle selection, exercise links
```

## Route

- Hash route: `#/muscle-wiki`
- Requires authentication (protected route)

## Related

- Exercise catalog API: `backend-node/src/routes/exercises.js`
- MuscleWiki import: `npm run import:musclewiki --prefix backend-node`
- Frontend overview: [../../README.md](../../README.md)
