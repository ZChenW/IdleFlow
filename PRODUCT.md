# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Linux desktop users on Wayland who want one dependable place to inspect, edit, and own their idle behavior without manually coordinating `swayidle`, lock commands, power-source rules, and inhibitors.

## Product Purpose

IdleFlow makes desktop idle policy legible and controllable. Success means a user can see who currently owns idle behavior, tune battery and AC timelines, save or take over deliberately, temporarily inhibit automation, verify locking, and safely return control to the prior policy.

## Positioning

IdleFlow treats idle behavior as an ordered policy with explicit ownership and a lock-before-suspend safety invariant, rather than as unrelated timeout settings.

## Operating Context

- A Tauri desktop window backed by the `idled` user service.
- Wayland desktops using `swayidle` and either QuickShell or `swaylock` for locking.
- Battery and AC profiles, each ordered as lock, display off, then optional suspend.
- Applications may publish inhibitors that defer idle actions during meetings, playback, or presentations.

## Capabilities and Constraints

- Shows daemon status, ownership, active power source, inhibition, and managed process identity.
- Edits battery and AC idle policy in minutes and validates stage ordering before saving.
- Can take over from an existing policy, inhibit or resume actions, test locking, and roll back ownership.
- Locking must succeed before automatic suspend; QuickShell is preferred and `swaylock` is the fallback.
- Existing product behavior, Chinese interface copy, and Tauri/Rust/React stack remain intact during the editorial redesign.

## Brand Commitments

- Product name: IdleFlow.
- The interface uses Wallpaper Console's Editorial implementation as its binding visual reference: oversized typographic identity, strict black rules, square controls, warm neutral paper, dense index notation, and restrained motion.
- Product truth stays operational and precise; the editorial treatment must not obscure state or familiar controls.

## Evidence on Hand

- Product behavior and copy: `apps/desktop/frontend/src/App.tsx`.
- Policy model and validation: `apps/desktop/frontend/src/model.ts` and `apps/desktop/frontend/src/model.test.ts`.
- System architecture and safety constraints: `docs/architecture.md` and `README.md`.
- Binding visual reference: `/home/chakew/Projects/wallpaper-console-rust/apps/tauri-gui/frontend/src/styles/editorialTheme.css`.
- No testimonials, benchmarks, customer claims, or commercial proof are present and none should be fabricated.

## Product Principles

- Make ownership visible before offering control.
- Present idle actions as one ordered policy.
- Preserve lock-before-suspend safety.
- Keep changes deliberate, reversible, and attributable.
- Prefer operational clarity over decorative expression.

## Accessibility & Inclusion

Controls retain semantic labels, keyboard focus, live status announcements, reduced-motion behavior, and responsive layouts down to a 320px viewport.
