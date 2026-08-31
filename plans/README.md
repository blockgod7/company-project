# Animation implementation plans

These plans are read-only specifications for the selected Recommended opportunities. They do not authorize Optional motion, route transitions, row stagger, layout-property animation, dependency additions, or behavior changes.

| Order | Plan | Severity | Status | Dependencies |
| --- | --- | --- | --- | --- |
| 1 | [001 — Add restrained entry motion to anchored menus](001-anchor-menu-entry-motion.md) | MEDIUM | DONE | None |
| 2 | [002 — Add a shared enter transition to modal overlays](002-modal-overlay-entry-motion.md) | MEDIUM | DONE | None; reuse the same `--ease-out` token |
| 3 | [003 — Reveal list content only after a blocking state recovers](003-list-content-recovery-motion.md) | MEDIUM | DONE | None; execute last because it adds a small shared-component wrapper |

## Recommended execution order

1. Execute plan 001 and verify 1440x900, 720x900, and reduced-motion behavior.
2. Execute plan 002 and regression-test every modal close path before proceeding.
3. Execute plan 003 and run the full loading/error/empty/stale-data matrix.

Each plan is independent and may be reverted independently. After implementation, review the diff with the `review-animations` standard before marking a plan DONE.
