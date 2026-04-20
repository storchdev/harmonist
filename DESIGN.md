# Harmonist UI Design Direction

## Product Context

Harmonist is a local-first audio analysis tool for musicians who need to detect, verify, and edit chord regions quickly. The interface should feel like a focused studio workspace: clear hierarchy, low visual noise, and controls that are easy to scan during repeated listening passes.

## Design Goals

1. Reduce eye strain for long editing sessions with softer contrast and larger touch targets.
2. Unify controls so every button, panel, input, and modal feels part of one system.
3. Keep the waveform as the primary visual anchor while making project actions obvious.
4. Preserve high information density without looking crowded.

## Visual Theme: "Warm Studio Daylight"

- **Mode:** Light, warm-neutral base (no heavy dark bias).
- **Mood:** Calm, tactile, and slightly analog.
- **Backgrounds:** Layered gradients with subtle radial highlights instead of flat blocks.
- **Accent family:** Teal for primary action, amber for AI and emphasis, rose for destructive actions.

## Color Tokens

- `--bg-page`: warm paper tone for overall app background.
- `--bg-surface`: elevated card/panel background.
- `--bg-surface-muted`: secondary panel background.
- `--text-strong`: main foreground text.
- `--text-muted`: labels/helper text.
- `--border-soft`: low-contrast border.
- `--accent`: primary interactive color.
- `--accent-strong`: hover/focus variant.
- `--success`: save/confirmed actions.
- `--danger`: destructive actions.
- `--focus-ring`: accessible focus state.

## Typography

- **Display + heading font:** `Fraunces` (expressive but readable).
- **UI/body font:** `Manrope` (clear numeric and label readability).
- **Scale:**
  - App title: 2.1rem-2.5rem
  - Section titles: 1.1rem-1.35rem
  - Body/controls: 0.95rem-1rem
  - Micro labels: 0.72rem-0.78rem, uppercase tracking

## Layout System

- Constrain content to centered max width for legibility on large monitors.
- Use a 12px/16px rhythm with consistent panel padding.
- Split active project area into:
  1. Top utility bar (project metadata + save/export actions)
  2. Waveform stage card
  3. Transport/control deck card
- Mobile behavior: stack sections vertically, keep primary actions full-width where needed.

## Component Standards

- **Buttons:** Shared shape, font weight, hover/focus states, and subtle lift animation.
- **Panels/Cards:** Soft border + light shadow + slight blur when over gradient areas.
- **Inputs/Select/Range:** Unified border, radius, and focus ring.
- **Modals:** Dimmed backdrop, rounded surface, consistent title and footer actions.
- **Badges/Pills:** Used for file state, IDs, and AI status messaging.

## Motion & Feedback

- Use 140-220ms transitions for hover/focus/open actions.
- AI action: maintain spinner, add clearer loading/ready contrast.
- Reveal of overlays (AI result, modals) uses short fade + slight translate.
- Avoid continuous/looping animation outside active progress indicators.

## Accessibility

- Ensure contrast meets WCAG AA for text and controls.
- Keep minimum control height around 40px for easier targeting.
- Preserve visible focus outlines for keyboard users.
- Avoid color-only feedback by pairing color with text/shape changes.

## Implementation Plan

1. Create shared design tokens and reusable utility classes in `frontend/src/app.css`.
2. Rebuild `frontend/src/App.svelte` layout into cohesive header, stage, and control panels.
3. Restyle `frontend/src/components/Waveform.svelte` overlays, editor modal, and context menu to match tokens.
4. Restyle `frontend/src/components/AiSettings.svelte` as a consistent modal with improved spacing and labeling.
5. Verify responsive behavior and run frontend checks/build.
