# 001 — Add restrained entry motion to anchored menus

- **Status**: DONE
- **Commit**: 9b4e4ac
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Missed opportunities
- **Estimated scope**: 1 file, about 35 CSS lines

## Problem

The employee/admin portal dropdown and the compact 720px overflow menu are spatially anchored to their trigger buttons, but both are conditionally inserted with no visual explanation of that origin.

```tsx
// frontend/src/components/AppShell.tsx:189 — current
{moreMenuOpen && (
  <div className="compact-overflow-menu" role="menu" aria-label="추가 메뉴">
```

```tsx
// frontend/src/components/AppShell.tsx:246 — current
{portalSwitcherOpen && (
  <div className="portal-dropdown" role="menu" aria-label="포털 선택">
```

Both nodes are removed immediately when their existing boolean becomes false. A CSS exit transition cannot run after DOM removal. Delaying unmount would add presence state, timers, click-outside edge cases, and focus-management risk to a high-frequency navigation surface.

## Target

Add an enter-only CSS transition using `@starting-style`. Do not add JavaScript or change component markup.

```css
/* frontend/src/styles/app-pages.css — target */
.portal-dropdown,
.compact-overflow-menu {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition:
    opacity 160ms var(--ease-out),
    transform 160ms var(--ease-out);
}

.portal-dropdown { transform-origin: top right; }
.compact-overflow-menu { transform-origin: top right; }

@starting-style {
  .portal-dropdown,
  .compact-overflow-menu {
    opacity: 0;
    transform: translateY(-4px) scale(.97);
  }
}

@media (max-width: 560px) {
  .portal-dropdown { transform-origin: top left; }
}

@media (prefers-reduced-motion: reduce) {
  .portal-dropdown,
  .compact-overflow-menu {
    transform: none;
    transition: opacity 120ms var(--ease-out);
  }

  @starting-style {
    .portal-dropdown,
    .compact-overflow-menu {
      opacity: 0;
      transform: none;
    }
  }
}
```

The menu must be interactive immediately on mount. Closing remains immediate because the current conditional render unmounts the DOM synchronously.

## Repo conventions to follow

- The existing curve is `--ease-out: cubic-bezier(.23, 1, .32, 1)` in `frontend/src/styles/app-foundation.css:20`.
- The portal chevron already uses `transform 160ms var(--ease-out)` in `frontend/src/styles/app-foundation.css:463`.
- Existing reduced-motion overrides live in `frontend/src/styles/app-pages.css:729`.
- Put the new rule in `frontend/src/styles/app-pages.css`, which is imported after `app-foundation.css` and already owns compact-navigation and interaction rules.

## Steps

1. In `frontend/src/styles/app-pages.css`, add the shared `.portal-dropdown, .compact-overflow-menu` entry transition after the compact overflow menu rules so source order is deterministic.
2. Set `transform-origin: top right` for both anchored menus.
3. In the existing `@media (max-width: 560px)` section or a later equivalent section, override `.portal-dropdown` to `transform-origin: top left` because that breakpoint changes its anchor from `right: 0` to `left: 0`.
4. Add the `@starting-style` block with exactly `opacity: 0` and `translateY(-4px) scale(.97)`.
5. Add a later `prefers-reduced-motion: reduce` override that removes transform and retains a 120ms opacity transition.
6. Do not change `moreMenuOpen`, `portalSwitcherOpen`, refs, click-outside handling, focus behavior, routes, or menu selection handlers.

## Boundaries

- Do NOT add exit/presence state, timers, transition-end handlers, keyframes, or dependencies.
- Do NOT delay unmount.
- Do NOT animate `top`, `left`, `right`, width, height, margin, or padding.
- Do NOT animate active menu changes or route changes.
- Do NOT change menu order, permissions, API data, ARIA attributes, or event handlers.
- If the conditional rendering around either menu no longer matches the cited code, STOP and report drift.

## Verification

- **Mechanical**: from `frontend/`, run `npm.cmd run build`; expect TypeScript and Vite build success. Run `npm.cmd run test:e2e`; expect existing navigation tests to pass.
- **Feel check**:
  - At 1440x900, open the portal selector and confirm it grows subtly from the top-right trigger without visible travel or delayed clickability.
  - At 720x900, open “더보기” and confirm the menu stays aligned to the trigger and does not produce horizontal scroll or layout movement.
  - At 560px or below, confirm the portal dropdown originates from top-left, matching `left: 0`.
  - Repeatedly open and close each menu. Entry should take 160ms; close should remain immediate by design.
  - In DevTools Animations, set playback to 10% and confirm only opacity and transform change.
  - Enable “Layout Shift Regions” and confirm no shift is recorded.
  - Emulate `prefers-reduced-motion: reduce`; confirm there is no movement or scaling and only a 120ms fade remains.
- **Done when**: both menus enter from their physical trigger, closing and handlers are unchanged, reduced motion removes movement, and no layout shift occurs.
