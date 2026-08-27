# 002 — Add a shared enter transition to modal overlays

- **Status**: DONE
- **Commit**: 9b4e4ac
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / Physicality & origin
- **Estimated scope**: 1 file, about 30 CSS lines

## Problem

Modal backdrops and centered surfaces appear instantly. The modal hierarchy is clear visually, but the abrupt insertion makes occasional task boundaries feel less connected.

Representative current structures:

```tsx
// frontend/src/components/MenuSettingsDialog.tsx:30,58-60 — current
if (!open) return null;
return (
  <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="menu-settings-dialog" role="dialog" aria-modal="true">
```

```tsx
// frontend/src/pages/ApprovalPage.tsx:766-768 — current
{approvalInfoOpen && (
  <div className="modal-backdrop" role="presentation">
    <div className="org-picker-modal approval-info-modal" role="dialog" aria-modal="true">
```

```tsx
// frontend/src/pages/DrawingManagementModals.tsx:135-137 — current
{uploadOpen && (
  <div className="modal-backdrop" role="presentation">
    <form className="pdm-upload-modal pdm-file-modal" role="dialog" aria-modal="true">
```

All audited modal variants use immediate conditional unmount. Exit motion would require delayed close state across several independent components and would risk backdrop click, submit-success close, and focus behavior.

## Target

Augment the existing shared `.modal-backdrop` in the last-loaded interaction stylesheet. Fade the entire overlay while scaling only its direct centered surface.

```css
/* frontend/src/styles/app-pages.css — target */
.modal-backdrop {
  opacity: 1;
  transition: opacity 160ms var(--ease-out);
}

.modal-backdrop > * {
  transform: scale(1);
  transform-origin: center;
  transition: transform 160ms var(--ease-out);
}

@starting-style {
  .modal-backdrop { opacity: 0; }
  .modal-backdrop > * { transform: scale(.97); }
}

@media (prefers-reduced-motion: reduce) {
  .modal-backdrop {
    transition: opacity 120ms var(--ease-out);
  }

  .modal-backdrop > * {
    transform: none;
    transition: none;
  }

  @starting-style {
    .modal-backdrop { opacity: 0; }
    .modal-backdrop > * { transform: none; }
  }
}
```

The backdrop opacity also fades its child surface, so the panel must not receive a second opacity transition. Keep the scale at `.97`, never `scale(0)`. Closing remains immediate.

## Repo conventions to follow

- `.modal-backdrop` layout and background are defined in `frontend/src/styles/approval-admin.css:185-193`; do not move or rewrite them.
- Overlay shadow token `--shadow-overlay` and curve `--ease-out: cubic-bezier(.23, 1, .32, 1)` live in `frontend/src/styles/app-foundation.css:17-20`.
- Shared interaction and reduced-motion rules live in `frontend/src/styles/app-pages.css:689-735`, and that stylesheet is imported after approval styles.
- Existing modal surfaces are direct children of `.modal-backdrop`; the structural selector avoids adding motion-only classes to every modal component.

## Steps

1. In `frontend/src/styles/app-pages.css`, add the `.modal-backdrop` opacity transition and `.modal-backdrop > *` centered transform transition after the existing interaction foundation.
2. Add one `@starting-style` block using `opacity: 0` for the backdrop and `scale(.97)` for its direct child.
3. Add a later reduced-motion block retaining a 120ms backdrop fade and removing all panel transform.
4. Verify the direct-child assumption against `MenuSettingsDialog.tsx`, `ApprovalTemplateParts.tsx`, `ApprovalPage.tsx`, `DrawingManagementModals.tsx`, equipment dialogs, and employee-management dialogs before implementation. If a backdrop contains a non-surface wrapper, scope that exception explicitly instead of changing DOM.
5. Leave all open/close booleans and handlers untouched.

## Boundaries

- Do NOT implement exit animation, delayed unmount, presence state, timers, portals, focus traps, or a new modal abstraction.
- Do NOT change backdrop click, submit, save, cancel, Escape, focus, API, permission, or routing behavior.
- Do NOT animate layout properties or add blur.
- Do NOT add opacity to both backdrop and panel.
- Do NOT exceed 160ms.
- If `.modal-backdrop > *` is not consistently the visible panel at commit time, STOP and report the exceptions before editing.

## Verification

- **Mechanical**: from `frontend/`, run `npm.cmd run build` and `npm.cmd run test:e2e`; both must pass.
- **Feel check**:
  - At 1440x900 and 720x900, open menu settings, approval template selection, approval information, and at least one drawing-management modal.
  - Confirm the backdrop and panel are fully interactive immediately and settle within 160ms.
  - Confirm the surface scales from center with no vertical travel and no scale-from-zero effect.
  - Close via X, cancel, backdrop click where supported, and successful submit. Closing must remain immediate and every existing handler must fire once.
  - Rapidly open/close/open; no stale invisible backdrop may block clicks.
  - At 10% DevTools playback, confirm the parent opacity and child transform are the only changing properties.
  - Enable Layout Shift Regions; opening must record no layout shift.
  - Emulate reduced motion; confirm panel scaling disappears and only the 120ms overlay fade remains.
- **Done when**: all audited modals share the same subtle centered entrance, close behavior remains synchronous, reduced motion contains no transform, and no dialog functionality regresses.
