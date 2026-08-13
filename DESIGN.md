---
name: IdleFlow
description: A compact monochrome policy console for Linux idle control.
colors:
  ink: "#000000"
  blackbar: "#0a0a0a"
  paper: "#f7f7f5"
  white: "#ffffff"
  muted: "#737373"
  soft: "#a3a3a3"
  line: "#e5e5e5"
  rule: "#d4d4d4"
  danger: "#8f1d1d"
typography:
  display:
    fontFamily: "Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Noto Sans CJK SC, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  data:
    fontFamily: "Maple Mono, monospace"
    fontWeight: 600
    lineHeight: 1
rounded:
  square: "0"
spacing:
  window: "100vw × 100dvh"
  inset: "32px"
  compact: "8px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
    height: "40px"
  input-minute:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.square}"
    width: "80px"
    height: "48px"
---

# Design System: IdleFlow

## Overview

**Creative North Star: “The Compact Policy Console”**

IdleFlow is a full-window desktop utility, not a dashboard or document. A black title bar frames a compact strategy editor: a narrow power-mode rail, two equal timelines, and one low action bar. The interface stays monochrome, square, and deliberately quiet so timing order is immediately legible.

## Colors

- **Ink** (`#000`): active routes, controls, text, and primary action.
- **Black Bar** (`#0a0a0a`): the application title bar only.
- **Paper** (`#f7f7f5`): main editing surface.
- **White** (`#fff`): input and footer surfaces.
- **Muted / Soft** (`#737373` / `#a3a3a3`): annotations and inactive policy mode.
- **Line / Rule** (`#e5e5e5` / `#d4d4d4`): structural separation and inactive routes.
- **Failure Red** (`#8f1d1d`): actionable errors only.

## Typography

The wide, heavy CJK-capable sans carries the `IDLEFLOW` wordmark and interface copy. Maple Mono is reserved for minute values. The hierarchy is intentionally compact: 52px identity, 20px policy title, 13px controls, and 9–10px route notation.

## Layout

The app fills `100vw × 100dvh`. The title bar is `64px`, policy heading `104px`, power rail `80px`, and action bar at least `56px`. The remaining height belongs to the strategy area: battery and AC rows split it equally while each retains a `178px` minimum. Both profiles remain simultaneously visible; the active mode uses ink while the inactive mode recedes in gray. Below `820px`, insets and controls compress. Below `560px`, labels simplify while the two-timeline comparison remains intact.

## Components

### Title Bar

A solid black strip holds the white wordmark and a compact refresh action. Refresh success and failures appear in the ruled notice row below the policy heading.

### Mode Rail

Battery and AC occupy equal vertical tabs. A three-pixel ink marker and full-opacity row identify the active editing context without hiding the other policy.

### Policy Timeline

Each row uses three equal stages, a continuous arrowed rule, value-positioned square range handles, dashed input connectors, stage labels, and 80×48 minute inputs. Range and number controls stay synchronized, and focus activates the power mode. Suspend alone adds the on/off control.

### Action Bar

Inhibitor behavior stays visible at left. The single primary action is a compact black `保存策略` button at right; its disabled state truthfully indicates there are no valid unsaved changes.

## Rules

- Keep corners square and use one-pixel lines for structure.
- Keep both power profiles visible for direct comparison.
- Use opacity only to distinguish inactive policy context, never to conceal it.
- Preserve real validation, raw input, refresh notices, and reduced-motion behavior.
- Do not restore status dashboards, maintenance controls, cards, shadows, or decorative color.
