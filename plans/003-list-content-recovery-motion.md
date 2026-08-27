# 003 — Reveal list content only after a blocking state recovers

- **Status**: DONE
- **Commit**: 9b4e4ac
- **Severity**: MEDIUM
- **Category**: State indication / Missed opportunities
- **Estimated scope**: 2 files, about 25 lines

## Problem

The shared list-state component correctly separates blocking loading, blocking error, stale-data refresh, and empty states. When a blocking state becomes real content, however, the branch swaps instantly.

```tsx
// frontend/src/components/ListState.tsx:23-46 — current
if (loading && !hasData) {
  return <div className="list-state list-state-loading" role="status">{loadingText}</div>;
}

if (error && !hasData) {
  return <div className="list-state list-state-error" role="alert">...</div>;
}

return (
  <>
    {loading && <div className="list-state-notice" role="status">목록을 새로 고치는 중입니다.</div>}
    {error && <div className="list-state-notice list-state-notice-error" role="alert">...</div>}
    {hasData ? children : empty}
  </>
);
```

Animating every table mount or data refresh would incorrectly create a route/list transition and repeated filter motion. The reveal must occur only when the same mounted `ListState` instance transitions from `hasData === false` to `hasData === true`.

## Target

Use one ref to remember whether the previous committed render had no data. Do not add React state, timers, keys, row animation, or handler changes.

```tsx
// frontend/src/components/ListState.tsx — target structure
import { useEffect, useRef, type ReactNode } from "react";

const wasBlockingRef = useRef(!hasData);
const recoveringToContent = hasData && wasBlockingRef.current;

useEffect(() => {
  wasBlockingRef.current = !hasData;
}, [hasData]);

// Keep the existing blocking loading/error early returns unchanged.
// In the final branch only:
{hasData ? (
  <div
    className="list-state-content"
    data-recovering={recoveringToContent ? "true" : undefined}
  >
    {children}
  </div>
) : empty}
```

```css
/* frontend/src/styles/app-pages.css — target */
.list-state-content {
  min-width: 0;
}

.list-state-content[data-recovering="true"] {
  opacity: 1;
  transition: opacity 120ms var(--ease-out);
}

@starting-style {
  .list-state-content[data-recovering="true"] {
    opacity: .86;
  }
}

@media (prefers-reduced-motion: reduce) {
  .list-state-content[data-recovering="true"] {
    transition-duration: 80ms;
  }
}
```

There is no transform, layout-property animation, or stagger. Existing-data refresh keeps `hasData === true`, so it does not reveal again. Remounting a list route with already available data initializes the ref to `false`, so it also does not create a route transition.

## Repo conventions to follow

- `ListState` is the shared state boundary used by Notice, Board, and Approval at `frontend/src/pages/NoticePage.tsx:102`, `BoardPage.tsx:148`, and `ApprovalPage.tsx:721`.
- Its existing stale-data behavior at `frontend/src/components/ListState.tsx:37-46` must remain unchanged.
- Use the existing `--ease-out: cubic-bezier(.23, 1, .32, 1)` token from `frontend/src/styles/app-foundation.css:20`.
- Place the CSS beside the existing list-state rules in `frontend/src/styles/app-pages.css:737-783`.

## Steps

1. In `frontend/src/components/ListState.tsx`, change the React import to include `useEffect` and `useRef` while retaining `ReactNode` as a type import.
2. After props are read and before any conditional return, initialize `wasBlockingRef`, derive `recoveringToContent`, and update the ref in an effect keyed only by `hasData`.
3. Preserve the blocking loading branch and blocking error branch byte-for-byte except for formatting required by the import.
4. Replace only `{hasData ? children : empty}` with the `list-state-content` wrapper shown above. Do not wrap the empty component, because `.board-screen > .empty` currently depends on direct-child structure.
5. In `frontend/src/styles/app-pages.css`, add the exact opacity transition and `@starting-style` rule beside existing list-state CSS.
6. Add the 80ms reduced-motion duration override; since this motion is opacity-only and communicates recovery, do not remove it entirely.

## Boundaries

- Do NOT add React state, timers, animation-end handlers, keys, or remount lists deliberately.
- Do NOT animate rows, table height, empty-state height, filter changes, list refresh with stale data, or route transitions.
- Do NOT change API calls, retry callbacks, error copy, loading copy, empty components, filters, table click handlers, permissions, or routing.
- Do NOT add transform, blur, or layout-property animation.
- Scope remains Notice, Board, and Approval through the existing shared `ListState`; do not retrofit unrelated pages in this plan.
- If any current `ListState` child depends on being a direct child of its page for CSS or semantics, STOP and report rather than improvising.

## Verification

- **Mechanical**: from `frontend/`, run `npm.cmd run build`; expect no TypeScript errors. Run `npm.cmd run test:e2e`; existing Notice, Board, Approval, retry, navigation, filtering, and row-click tests must pass.
- **State matrix**:
  - `loading(false data) → content`: one 120ms opacity reveal.
  - `error(false data) → retry → content`: error remains fully usable until the response commits, followed by one reveal.
  - `empty → refresh → content`: one reveal when data first becomes non-empty.
  - `content → refresh loading with existing data → content`: no reveal and existing rows remain visible.
  - `content → refresh error with existing data`: no reveal; stale list and retry notice remain intact.
  - filter/box change while data remains present: no row or whole-list animation.
  - detail → list with cached data: no route-transition fade.
- **Feel check**:
  - Test Notice, Board, and Approval at 1440x900 and 720x900.
  - At 10% playback, confirm opacity starts at `.86`, reaches `1`, and no transform or row stagger occurs.
  - Enable Layout Shift Regions; the wrapper must not change table dimensions or create a shift.
  - Emulate reduced motion; confirm the same comprehension cue remains as an 80ms opacity-only transition.
- **Done when**: only true blocking-state recovery reveals content, existing-data refresh and navigation stay immediate, all state messages and retries behave identically, and no layout shift occurs.
