---
name: IdleFlow
description: An editorial policy desk for safe, legible Linux idle control.
colors:
  ink: "#0a0a0a"
  paper: "#f4f4f0"
  white: "#ffffff"
  muted-ink: "#5b5b56"
  soft-ink: "#7a7a73"
  rule: "#b7b7b0"
  wash: "#e8e8e2"
  danger: "#8f1d1d"
  danger-wash: "#f1dddd"
typography:
  display:
    fontFamily: "Noto Sans ExtraCondensed, sans-serif"
    fontSize: "clamp(4rem, 12vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "clamp(28px, 3vw, 44px)"
    fontWeight: 820
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "12px"
    lineHeight: 1.55
  data:
    fontFamily: "Maple Mono, monospace"
    fontWeight: 600
    lineHeight: 1
rounded:
  square: "0"
spacing:
  gutter: "clamp(16px, 2vw, 30px)"
  compact: "8px"
  section: "18px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    padding: "14px 20px"
    height: "94px"
  input-minute:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.square}"
    height: "56px"
---

# Design System: IdleFlow

## Overview

**Creative North Star: "The Policy Desk"**

IdleFlow behaves like an independent modernist technical periodical made operational: one warm paper field, decisive black rules, oversized identity, and compact data notation. Hierarchy comes from type scale, inversion, and spatial order—not cards or ornament. Expression must never obscure ownership, stage order, action availability, or the lock-before-suspend safety invariant.

**Key Characteristics:**

- Oversized extra-condensed masthead
- Warm neutral paper and black ink
- Square controls and one-pixel rules
- Monospaced measurements and labels
- Ordered dual policy timelines
- Restrained, structural motion

## Colors

The palette is nearly monochrome: paper and ink carry the system, cool neutrals separate states, and red appears only for actionable failure.

- **Policy Ink** (`#0a0a0a`): text, structural rules, active marks, and primary actions.
- **Editorial Paper** (`#f4f4f0`): the continuous application field.
- **Ledger Rule** (`#b7b7b0`): subordinate divisions and dotted facts.
- **Selection Wash** (`#e8e8e2`): selected editing regions without elevation.
- **Failure Red** (`#8f1d1d`) / **Failure Wash** (`#f1dddd`): error copy and its flat background.

**The Ink Economy Rule.** Use solid black fields only for ownership, active selection, or the primary action; their rarity creates leverage.

## Typography

**Display Font:** Noto Sans ExtraCondensed Black, self-hosted.

**Body Font:** Noto Sans CJK SC with system sans fallbacks.

**Data Font:** Maple Mono SemiBold, self-hosted.

The display face supplies the masthead's editorial authority. Body CJK remains practical and highly legible. Maple Mono is reserved for measurements, English stage codes, process data, and terse labels—not general prose.

- **Display** (900, `clamp(4rem, 12vw, 6rem)`, .78): `IDLEFLOW` and loading identity only.
- **Headline** (820, `clamp(28px, 3vw, 44px)`, .95): primary policy title.
- **Title** (750–820, 15–40px): rail statements, profile names, section titles.
- **Body** (10–12px, 1.45–1.55): operational explanation and recovery copy.
- **Data/Label** (600, 7–13px): minutes, status facts, stage codes, and index notation.

**The Measurement Rule.** Maple Mono denotes machine-readable facts; using it as decorative body type weakens the interface.

## Layout

Desktop uses an editorial masthead followed by a horizontal system-status strip and a full-width policy sheet. Refresh occupies the masthead's top-right support position; ownership, Runtime facts, and operational controls share the status strip. The policy sheet gives both power profiles equal horizontal timelines. The responsive system changes at 900px, 680px, and 460px: the strip wraps its actions first, then status regions stack, and finally policy controls simplify. The reading order stays ownership → status/actions → policy → save. The outer gutter is `clamp(16px, 2vw, 30px)`.

## Elevation & Depth

There are no shadows, glass, blur, or raised containers. Depth is expressed through black/white inversion, line weight, selection wash, and whitespace. Overlays are not part of this surface.

**The Flat Ledger Rule.** A new surface joins the ruled field; it does not float above it.

## Shapes

Corners are square. Structural divisions use one-pixel rules; two pixels are reserved for keyboard focus or selected emphasis. Circles are not a container language. Small square marks indicate status, timeline stops, and saved/dirty state. Icons use consistent authored 24×24 line geometry with square caps and miter joins.

## Components

### Buttons

- **Primary:** a large ink field with paper text, square corners, and no shadow.
- **Secondary:** transparent paper with a one-pixel ink rule; hover inverts ink and paper.
- **Focus:** a two-pixel ink outline with three-pixel offset.
- **Disabled:** retains geometry at 42% opacity.

### Inputs / Fields

Minute inputs are square two-cell ledgers: a large centered tabular value plus a narrow `MIN/OFF` unit cell. Focus draws inside the field so the timeline geometry does not jump. Disabled fields use the selection wash and muted ink.

### Policy Timeline

The signature module presents battery and AC as equal ordered routes. Each route uses one continuous axis, square stops, explicit stage names, editable minute fields, and an arrowhead. Selection may add a wash and rule without interrupting the axis.

### Notices

Notices remain flat ruled rows. Errors alone use Failure Red and Failure Wash; success stays in the neutral palette.

## Do's and Don'ts

### Do:

- **Do** keep operational state and actions readable within seconds.
- **Do** use one-pixel rules to organize the continuous paper field.
- **Do** preserve square geometry, tabular numerals, and semantic controls.
- **Do** provide reduced-motion behavior for the timeline reveal.

### Don't:

- **Don't** introduce rounded cards, bento grids, gradients, glass, or decorative shadows.
- **Don't** use Maple Mono for general prose or Noto Sans ExtraCondensed for body copy.
- **Don't** hide ownership, inhibitor state, validation, or lock safety behind decoration.
- **Don't** replace the live masthead, icons, or timeline geometry with raster UI chrome.
