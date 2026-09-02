---
name: telegram-native-design
description: The visual language of this site — a Telegram-native system of blue accent, messenger bubble geometry and light/dark parity. Use when adding or restyling any UI here: a new page, section, control, form field, card, animation or icon, or when a change involves colour, spacing, type, radii or motion. Read before writing CSS or a component's markup, so new work matches rather than drifts.
---

# Telegram-native design system

This site sits *next to* Telegram — it borrows the visual language of a
messenger without reproducing Telegram's application UI or logo. The only
Telegram-derived marks in use are the project's own chat-bubble mark and a
paper-plane glyph, both in `src/components/Icons.jsx`.

## The one rule

**Every value resolves through a token in `src/index.css`.** Nothing is
hard-coded in a component. That is what makes the light/dark swap a single
`data-theme` attribute with no other branching — and it breaks the moment
someone writes a literal hex in a component stylesheet.

Light is the base on `:root`; `[data-theme="dark"]` redefines only what
differs. A colour must never be defined *only* inside the dark block.

| Token | Use |
| --- | --- |
| `--tg-blue` | accent: buttons, links, active chrome, hub, chat header disc |
| `--tg-blue-strong` | hover / pressed |
| `--tg-blue-ink` | accent *text* on tinted fills (readable on both grounds) |
| `--bg` | chat ground, bands, inputs |
| `--bg-alt` | page ground |
| `--surface` | cards, composer, labels |
| `--bubble-in` / `--bubble-out` | assistant / visitor bubbles, disabled fills |
| `--ink` / `--ink-muted` | text, secondary text |
| `--line` | every border |
| `--danger` | error text and borders (`#d64d3f` light, `#f08b7f` dark) |

**Tinted fills** are always `color-mix(in srgb, var(--tg-blue) N%, transparent)`
— 5–8% for panels, 12–16% for chips and discs, 22% for a tinted border. Never a
second opaque blue.

**One deliberate exception:** the Telegram sign-in control keeps
`--provider-blue` (`#2aabee`), Telegram's own blue, which is *not* `--tg-blue`.
It is a provider button and should read as one, the way a Google sign-in does.
Nothing else may use it.

## Shape

- **999px** — pills: buttons, chips, badges, the notice, the reference code
- **22px** — composer textarea
- **18px** — bubbles, with a **6px** corner on the speaker's side
  (`border-start-start-radius` assistant, `border-end-end-radius` visitor)
- **14px** (`--r-card`) — cards
- **10px** (`--r-input`) — inputs and inline panels

Touch targets stay ≥ 44px. The send button and pills already are.

## Type

Vazirmatn 400/500/600/700, loaded asynchronously, with a system fallback.

`52 / 34 / 30` display and headings (700, `letter-spacing: -0.02em`) ·
`19` card title (600) · `17` body-large and form title · `15` body, bubbles,
inputs · `14` UI labels · `13` meta and chips · `12` hints and kickers ·
`11` badges and section labels. Line-height 1.08–1.2 for headings, 1.55–1.7
for prose.

## Spacing

Page gutter `--gutter` (22px, 16px under 600px) · section rhythm 40–72px ·
card padding 18–22px · grid gaps 14px (cards) and 44px (two-column bands) ·
stream gap 10px · form field gap 16px.

## Motion

All CSS on inline SVG — no library, no canvas, no JS ticker.

| Keyframe | Timing | Where |
| --- | --- | --- |
| `tgn-in` | `.22s ease-out` | bubbles, cards, notice, revealed details |
| `tgn-dot` | `1.1s` / `2.2s` | typing indicator / hero mark dots |
| `tgn-breathe` | `4.5s` / `5s` ease-in-out | hero mark / hub core |
| `tgn-plane` | `6.6s cubic-bezier(.4,0,.5,1)` | the plane leaving, once per cycle |
| `tgn-ring` | `70s linear` | hub orbit |
| `tgn-veil` | `900ms ease-in-out` | language transition |

Hover transitions are `.15s ease`. The global reduced-motion reset collapses
all of it; because nothing depends on an animation *finishing*, no component
needs its own exception.

A sequence driven from JavaScript is the exception the CSS reset cannot reach.
`BookingDemo.jsx` plays a scripted chat on a timer, so it reads
`prefers-reduced-motion` itself: the keyboard is still offered and still
answers a tap, but nothing auto-picks and nothing loops. Any future autoplaying
surface owes the same — collapsing its CSS durations is not enough. It also
pauses while scrolled out of view, and only stages the machine can re-enter are
resumable; a transition stage restarts the loop instead of stalling it.

## RTL

Logical properties everywhere — `padding-inline`, `inset-inline-start`,
`border-block-end`, `margin-inline-start: auto`. Never `left`/`right` for
layout. Any value a visitor authored gets `dir="auto"` so a Persian page
showing English text still reads correctly.

Symmetrical geometry needs no mirroring. Prefer symbols that need no direction
logic: the form's disclosure uses `+` / `−` precisely so it needs no RTL
rotation rule, unlike the chevron it replaced.

## The language transition

Persian detection is unchanged (`src/lang.js`: ≥ 3 Persian letters, more than
the Latin count). One-way, never persisted, no button.

`0ms` veil mounts → `420ms` language and `dir` swap **behind full opacity** →
`900ms` veil unmounts → `~4200ms` notice pill goes. The swap being hidden is
the entire point: the RTL/LTR reflow is never seen, so no separate page fade
is needed.

## The one tokenless surface

`CodeFilm.jsx` is a fixed dark artifact — a code editor, the way an embedded
screen recording is — and re-theming it to a light page would look wrong. It
carries its own palette on purpose. Its accent still follows `--tg-blue`, and
it is the only exception; do not treat it as licence for a second one.

## What not to do

- No second styling system. Restyle by changing tokens and the existing
  component stylesheets, never by adding a parallel one.
- No second source of strings or field definitions. Copy lives in
  `src/i18n.js`, fields and options in `shared/formSchema.js` and
  `shared/questionModules.js`. Landing copy that describes options (the trust
  strip, the checklist) must stay true to those option sets.
- No icon font. Icons are small inline SVG components in `Icons.jsx`.
- Don't add a colour without adding it to both themes.
