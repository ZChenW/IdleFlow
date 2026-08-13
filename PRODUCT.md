# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Linux desktop users on Wayland who want one dependable place to inspect, edit, and own their idle behavior without manually coordinating `swayidle`, lock commands, power-source rules, and inhibitors.

## Product Purpose

IdleFlow makes desktop idle policy legible and controllable. The current editor succeeds when a user can compare battery and AC timelines, adjust their ordered stages, and save a valid policy without changing ownership.

## Positioning

IdleFlow treats idle behavior as an ordered policy with explicit ownership and a lock-before-suspend safety invariant, rather than as unrelated timeout settings.

## Operating Context

- A Tauri desktop window backed by the `idled` user service.
- Wayland desktops using `swayidle` and either QuickShell or `swaylock` for locking.
- Battery and AC profiles, each ordered as lock, display off, then optional suspend.
- Applications may publish inhibitors that defer idle actions during meetings, playback, or presentations.

## Capabilities and Constraints

- Edits battery and AC idle policy in minutes and validates stage ordering before saving.
- The service supports takeover, inhibition, lock testing, and rollback, but these maintenance controls are intentionally outside the focused policy editor.
- Locking must succeed before automatic suspend; QuickShell is preferred and `swaylock` is the fallback.
- Chinese interface copy and the Tauri/Rust/React stack remain intact during visual changes.

## Brand Commitments

- Product name: IdleFlow.
- The interface uses `kimi/idleflow_optimized.html` as its binding visual reference: a full-window compact console, black application bar, narrow mode rail, dual timelines, square controls, and restrained motion.
- Product truth stays operational and precise; the compact treatment must not obscure validation, active editing context, or save state.

## Evidence on Hand

- Product behavior and copy: `apps/desktop/frontend/src/App.tsx`.
- Policy model and validation: `apps/desktop/frontend/src/model.ts` and `apps/desktop/frontend/src/model.test.ts`.
- System architecture and safety constraints: `docs/architecture.md` and `README.md`.
- Binding visual reference: `kimi/idleflow_optimized.html`.
- No testimonials, benchmarks, customer claims, or commercial proof are present and none should be fabricated.

## Product Principles

- Present idle actions as one ordered policy.
- Preserve lock-before-suspend safety.
- Keep changes deliberate, reversible, and attributable.
- Prefer operational clarity over decorative expression.

## Accessibility & Inclusion

Controls retain semantic labels, keyboard focus, live status announcements, reduced-motion behavior, and responsive layouts down to a 320px viewport.
