# Design System — Decrypt ("Neon Spy Console")

> Authoritative source for color, typography, spacing, motion, and accessibility.
> Tokens below are the blueprint's specified identity (the generator's generic
> "Accessible & Ethical" template was not a match; its **accessibility guidance** —
> focus rings, 44px touch targets, reduced-motion, responsive breakpoints, SVG icons,
> contrast — is folded in below). Phase E visually reviews the built UI against this.

## Brand & Mood
Premium, tactile, trustworthy spy console. Deep dark surface, glassmorphic panels with
subtle blur, soft team-colored glows, crisp modern type with a technical monospace accent.
Feels instant and designed — not a prototype.

## Color Tokens
```css
/* Surfaces */
--bg:            #0A0E1A;  /* deep near-black background */
--surface:       #121829;  /* raised panel base */
--surface-glass: rgba(18, 24, 41, 0.55); /* glassmorphic panel (with backdrop-blur) */
--border:        rgba(148, 163, 184, 0.18);
--fg:            #E6EDF6;  /* primary text on dark */
--fg-muted:      #9CA3AF;  /* secondary text */

/* Teams */
--cyan:          #22D3EE;  --cyan-fg:  #042F35;  --cyan-glow: rgba(34, 211, 238, 0.45);
--amber:         #F59E0B;  --amber-fg: #2A1A00;  --amber-glow: rgba(245, 158, 11, 0.45);

/* Card identities */
--neutral:       #9CA3AF;  /* warm grey bystander */
--assassin:      #EF4444;  /* danger crimson */

/* Feedback */
--success:       #34D399;  --warning: #FBBF24;  --error: #EF4444;
--ring:          #22D3EE;  /* focus ring (3px) */
```
Contrast: all text meets **WCAG AA** (≥4.5:1 body, ≥3:1 large). Card text uses the
team `*-fg` tokens on filled cards for contrast.

## Typography
- **UI / body:** `Inter`, system-ui fallback. Weights 400/500/600/700.
- **Monospace accent:** `JetBrains Mono` (or `ui-monospace`) for the room **code** and the
  **timer** only.
- Base size 16px; never below 14px for interactive text. Scale: 12 / 14 / 16 / 20 / 24 /
  32 / 48.

## Spacing & Layout
- 4px base unit; spacing scale 4/8/12/16/24/32/48/64. Generous padding on panels (24–32).
- Radii: cards `rounded-2xl` (16px), panels `rounded-3xl` (24px), buttons `rounded-xl`.
- Board: responsive 5×5 grid; square-ish cards; `gap-3`/`gap-4`. Desktop max-width
  container; mobile portrait stacks scoreboard above board, clue panel below.
- **Responsive breakpoints to verify:** 375px, 768px, 1024px, 1440px.

## Components (visual contracts)
- **GlassPanel:** `--surface-glass` + `backdrop-blur-md` + 1px `--border` + soft shadow.
- **Card:** rounded, word centered; unrevealed = neutral dark face; spymaster overlay tints
  the face faintly with the identity color + a small identity **icon/label** (never color
  alone). On reveal: **3D flip** (rotateY) to the identity color with the `*-fg` text and a
  reveal icon; revealed assassin shows a skull glyph, neutral a dash, agents a team glyph.
- **TurnTimer:** circular **countdown ring** (SVG stroke-dashoffset) + monospace MM:SS,
  team-colored; derives from `turn_deadline`.
- **Scoreboard:** two team chips with remaining counts; active team gets a glow pulse.
- **Button:** primary (team or cyan accent), secondary (ghost on glass); `cursor-pointer`;
  hover transition 150–300ms; visible focus ring.
- **GameSummary:** full-screen glass overlay, full board revealed, confetti/scanline win
  animation, Rematch CTA.

## Motion
- Card flip on reveal (3D rotateY, ~300ms, ease-out). Active-turn glow pulse (slow).
- Countdown ring smooth tick. Confetti/scanline on win. Gentle entrance fades/slides.
- **`prefers-reduced-motion`:** disable flips/confetti/pulses; use instant state changes
  with a subtle opacity fade only.

## Accessibility (WCAG AA — enforced)
- **Color is never the only signal:** every team/neutral/assassin state carries an icon
  and/or text label for color-blind users.
- Full keyboard nav: cards are `button`/`role` focusable (Tab), Enter/Space reveals;
  visible **3–4px focus rings**; logical tab order; skip link to the board.
- Screen-reader live regions announce reveals ("Cyan revealed FALCON — agent") and turn
  changes ("Amber's turn — clue phase").
- Touch targets ≥ **44×44px**. Icons are SVG (Heroicons/Lucide), never emoji.
- All interactive elements have hover + focus + disabled states.

## Pre-delivery checklist (Phase E)
- [ ] SVG icons only (no emoji as icons)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover transitions 150–300ms
- [ ] Text contrast ≥ 4.5:1
- [ ] Visible keyboard focus states
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375 / 768 / 1024 / 1440px
- [ ] Operative view never renders unrevealed identity colors/icons
