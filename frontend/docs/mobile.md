# Mobile layout conventions (Taqwin)

## Breakpoints (Tailwind defaults)

| Token | Min width | Usage |
|-------|-----------|--------|
| `sm` | 640px | Stack → row, show compact titles |
| `md` | 768px | Two-column grids |
| `lg` | 1024px | Persistent sidebar, hide bottom nav |

Use `useBreakpoint()` from `lib/hooks/useBreakpoint.ts` for JS logic (never raw `window.innerWidth`).

## App shell

- **Desktop (`lg+`)**: Sidebar + header; `GymScene` 3D background when performance allows.
- **Mobile (`<lg`)**: Drawer sidebar, **bottom tab bar** (`MobileBottomNav`), main content `pb-24`, chat FAB above nav.
- Safe areas: `safe-top` on header, `safe-bottom` on bottom nav and sheets.

## New pages checklist

1. Page root: `overflow-x-hidden`, `min-w-0` on flex children.
2. Titles: `text-3xl sm:text-5xl` (or similar).
3. Grids: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
4. Touch targets: `min-h-11` on primary buttons/inputs.
5. Modals: `items-end sm:items-center`, `rounded-t-3xl sm:rounded-3xl`, `max-h-[90dvh]`.
6. Hide decorative 3D visuals: `hidden lg:block` on `*Visual` wrappers.
7. Test RTL (`html[dir='rtl']`) for nav and padding.

## PWA

`manifest.webmanifest` + `vite-plugin-pwa` for installable home-screen experience. Test after responsive QA on real iOS Safari.
