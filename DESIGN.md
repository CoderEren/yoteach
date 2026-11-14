> Stage 2 lecture revision (14 November 2026): the approved color, typography, glass and accessibility tokens below remain authoritative. Historical course/roadmap/tab and pear-shaped mascot descriptions are superseded: exactly AI tutor and Lecture walkthrough, with saved material/settings/history; twin-disc yo-yo and expressive string from the supplied reference. See `.impeccable/lecture-revision.md`.

---
name: "yoteach"
description: "A calm local learning workspace with a living glass companion."
colors:
  bg: "#f6f8fc"
  bg-secondary: "#eef3fc"
  text: "#172034"
  muted: "#657188"
  subtle: "#758099"
  iris: "#5f4fc4"
  iris-soft: "#edeafd"
  panel: "rgba(255, 255, 255, 0.72)"
  solid: "#fff"
  line: "#e1e6ef"
  glass-line: "rgba(255, 255, 255, 0.94)"
  hover: "rgba(118, 104, 246, 0.07)"
  danger: "#b13d4e"
  focus: "#7668f6"
  dark-bg: "#0b1020"
  dark-bg-secondary: "#111a2e"
  dark-text: "#f4f7ff"
  dark-muted: "#a0acc4"
  dark-subtle: "#9ba7c0"
  dark-iris: "#b4aaff"
  dark-iris-soft: "#292448"
  dark-panel: "rgba(24, 33, 54, 0.88)"
  dark-solid: "#1a2439"
  dark-line: "#2b3650"
  dark-glass-line: "rgba(154, 172, 216, 0.12)"
  dark-hover: "rgba(164, 150, 255, 0.1)"
  dark-danger: "#ff9caa"
  dark-focus: "#b4aaff"
  primary-fill: "#6b5cdb"
  primary-hover: "#6859e4"
  on-filled: "#fff"
  ink-fill: "#222c43"
  ink-hover: "#36425c"
  dark-welcome-action: "#7163e7"
  destructive-fill: "#aa3446"
  course-iris-ink: "#7462d8"
  course-iris-fill: "#f0edfb"
  course-cyan-ink: "#267f90"
  course-cyan-fill: "#e7f3f6"
  course-rose-ink: "#b16778"
  course-rose-fill: "#f8edf0"
  course-sage-ink: "#458575"
  course-sage-fill: "#e9f3ef"
  dark-course-iris-ink: "#b5a9fb"
  dark-course-iris-fill: "#27223f"
  dark-course-cyan-ink: "#77cedc"
  dark-course-cyan-fill: "#182f3c"
  dark-course-rose-ink: "#eab1c0"
  dark-course-rose-fill: "#372536"
  dark-course-sage-ink: "#8bc7b8"
  dark-course-sage-fill: "#203631"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-1px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.8px"
  topic-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.55px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 650
    letterSpacing: "-0.2px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  nav-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 550
  metadata:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "10px"
    fontWeight: 400
rounded:
  chip: "6px"
  icon: "8px"
  field: "9px"
  control: "10px"
  resume: "13px"
  course: "16px"
  surface: "20px"
  round: "50%"
spacing:
  tight: "6px"
  icon-gap: "8px"
  control-gap: "10px"
  field: "12px"
  rail: "16px"
  section: "20px"
  content: "25px"
  group: "30px"
  gutter: "35px"
  wide-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary-fill}"
    textColor: "{colors.on-filled}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-ink:
    backgroundColor: "{colors.ink-fill}"
    textColor: "{colors.on-filled}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-destructive:
    backgroundColor: "{colors.destructive-fill}"
    textColor: "{colors.on-filled}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 15px"
  button-text:
    textColor: "{colors.iris}"
    typography: "{typography.label}"
    padding: "6px 0"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.icon}"
    padding: "7px"
    width: "32px"
    height: "32px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "12px"
  nav-selected:
    backgroundColor: "{colors.iris-soft}"
    textColor: "{colors.iris}"
    typography: "{typography.nav-label}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  state-chip:
    backgroundColor: "{colors.solid}"
    textColor: "{colors.text}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  course-card:
    textColor: "{colors.text}"
    rounded: "{rounded.course}"
    padding: "20px 19px 0"
  glass-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
---

# Design System: yoteach

## Overview

**Creative North Star: "The Quiet Study Desk"**

yoteach is a calm desk for lecture materials, with a living glass companion beside it. Premium restraint comes from pale translucent surfaces, a stable reading rail, compact system typography, and small iris accents. Lavender and icy blue belong to the glass and Yoyo; the student’s course names, notes, and source documents remain the visual priority.

The material stays consistent across light and dark themes: bright frosted glass becomes deep blue glass, with brighter lavender foregrounds and restrained borders. Yoyo supplies warmth through an original pear-shaped SVG and gentle motion. The mascot remains visually separable from the workspace and replaceable without changing companion behavior.

**Key Characteristics:**

- Readable liquid glass with thin edges and diffuse depth.
- One system font family, compact controls, and clear title-to-detail hierarchy.
- Persistent desktop navigation with spacious study surfaces.
- Iris selection states, quiet course color families, and a lavender-to-icy-blue mascot.
- Honest empty states, local activity, and explicitly labelled future features.

This is the implemented Stage 1 system, extracted from `src/styles.css`, the React components, and Electron window definitions. The empty, populated, dark, narrow-desktop, topic, and expanded-companion review captures establish visual composition; current source tokens are normative for exact values. It records an autonomous code build, not a user-approved comp.

## Colors

The palette pairs cool paper and deep blue neutrals with iris actions, pale lavender selections, and quiet course tints. Frontmatter values are normative; the names below explain their use. `dark-` entries record overrides under `data-theme="dark"`, not a second palette to mix into the light theme.

### Primary

- **Iris action** (`primary-fill`, `primary-hover`, `on-filled`): filled primary controls and their hover state. White text against the default fill measures approximately 5.03:1.
- **Iris foreground** (`iris`, `iris-soft`): text actions, selected navigation, roadmap items, and selected preview states. The light-theme foreground on its soft selection surface measures approximately 5.23:1. Dark mode uses the recorded brighter lavender pair.
- **Focus iris** (`focus`): visible keyboard outlines. It is intentionally separate from filled primary controls.
- **Ink action** (`ink-fill`, `ink-hover`, `dark-welcome-action`): the welcome surface’s create/continue control. Its dark-theme override is scoped to the welcome surface, not every ink button.

### Secondary

- **Course iris, cyan, rose, and sage** (`course-*-ink`, `course-*-fill`): paired icon, marker, and card tints. Each has a dark-theme pair. A course’s selected color repeats in its sidebar dot, card, and course symbol.
- **Yoyo lavender and icy blue**: the original SVG’s local gradients describe its frosted body and fins. These illustration colors are asset details, not semantic application states.

### Neutral

- **Cool paper / deep blue canvas** (`bg`, `bg-secondary`): application backing, field surfaces, and the PDF reading area.
- **Frosted panel / solid surface** (`panel`, `solid`): glass containers versus dialogs, selected utility surfaces, and controls that need an opaque backing.
- **Ink / quiet ink** (`text`, `muted`, `subtle`): primary reading, supporting copy, and minor status details.
- **Fine edge / glass edge** (`line`, `glass-line`): structural dividers and reflective glass boundaries. Hover wash (`hover`) is a low-opacity accent, not a new surface hierarchy.

### Semantic feedback

- **Danger** (`danger`, `destructive-fill`): error text, destructive emphasis, and the destructive confirmation button. Pair status color with explanatory text or an icon.
- The small green companion/status dot and toast check are local indicators in the implementation. They do not establish learning progress or a mastery scale.

**The Readable Glass Rule.** Use the theme’s foreground and surface pair together. Keep reading content on quiet glass or solid surfaces; reserve richer gradients for the welcome surface and Yoyo.

**The Accent Roles Rule.** Use the filled primary color for prominent actions and the iris foreground for links, focus-related emphasis, and selected items. Course colors identify courses; they do not encode mastery.

The sidecar’s eight-step OKLCH ramps are derived swatch previews. They are not additional shipped tokens and do not replace the source CSS colors.

## Typography

The display, body, labels, and reading text use the same platform system stack. The macOS result is native-feeling, compact, and lightly tightened at larger sizes. There is no custom webfont and no mathematical type scale; the role sizes are chosen for this desktop interface.

- **Display:** the page heading uses the frontmatter display role. It becomes smaller on narrow desktop windows (25px) and larger on wide windows (32px).
- **Headline:** the welcome heading uses the headline role, reducing to compact sizing (23px) at the narrow breakpoint.
- **Topic title:** the selected topic uses the topic-title role, reducing slightly (21px) on narrow desktop windows. Course titles use their own compact heading treatment (25px, weight 600).
- **Title:** dashboard section headings use the title role. Course-card titles are larger (17px, weight 600); in-panel section titles are smaller (14px, weight 600).
- **Body:** note text uses the body role with a comfortable measure (70ch). Empty note prompts use a slightly shorter measure (65ch). Welcome and explanatory paragraphs use the same compact size with line heights appropriate to their container (1.6–1.9).
- **Label and metadata:** controls use the label role; navigation uses nav-label. Secondary details generally run from small metadata (9–11px). The companion’s compact preview controls use smaller labels (9px); these are intentional desktop density, not a mobile text specification.
- **Document text alternative:** extracted PDF text keeps the system family, a larger reading size (13px), open line spacing (1.9), and a bounded measure (72ch). Long notes, course names, topic titles, and document names can wrap; the course rail and breadcrumb may truncate with ellipses.

**The One Typographic Voice Rule.** Use the system stack throughout. Establish hierarchy with size, weight, spacing, and color rather than introducing a display or monospace family.

## Layout

The Electron workspace opens at a useful desktop size (1280 × 850px), with a native minimum (980 × 680px). The renderer has a CSS width floor (960px). The shipped layout is desktop-only; the review captures cover a standard desktop window and a narrow desktop window, not a phone layout.

The shell fills the window and holds a fixed course rail beside a flexible main region. The main region has a stable top bar (74px) and an independently scrolling content area. Primary content is centered with a maximum width (1260px). The rail reserves a native titlebar region (65px); interactive top-bar controls remain outside draggable regions.

| Desktop width | Course rail | Main top / side padding | Roadmap column | Layout behavior |
| --- | --- | --- | --- | --- |
| Up to 1100px | 190px | 28px / 25px | 210px | Compact headings, smaller search field, tighter tab gaps; breadcrumb label hides. |
| 1101–1399px | 220px | 34px / 35px | 240px | Default workspace density. |
| 1400px and above | 240px | 40px / 48px | 270px | More breathing room, larger welcome mascot, wider tab gaps. |

The dashboard combines a broad welcome surface, an optional resume row, and two lower regions: courses and recent local activity. Course cards stay in a two-column grid. The course workspace pairs a roadmap with a flexible reading panel; nested roadmap rows indent against a fine vertical guide. Tab labels can scroll horizontally if needed. The roadmap tree and main area scroll independently where content exceeds available height.

Spacing is a practical scale of small control gaps, medium container padding, and wider section separation, as recorded in frontmatter. It is not a rigid four-point grid. Keep related actions close and use larger gaps to separate task regions.

Standard dialogs are bounded (470px wide, at most 90vw and 88vh). The PDF dialog is wider (1050px, at most 94vw) and tall (88vh), with a fixed heading and toolbar above its scrolling reader.

The separate transparent companion window is compact at rest (200 × 220px) and expands to a small panel above Yoyo (350 × 540px). The character remains anchored toward the lower-right; resizing preserves that corner where display bounds allow. Its grip is the native drag affordance. The panel’s interior can scroll without enlarging the window.

**The Desktop Continuity Rule.** Preserve the course rail and study columns across the supported desktop window range. Narrow desktop widths reduce gutters and density; they do not switch to a mobile navigation pattern.

## Elevation & Depth

Depth comes from a restrained combination of translucent surfaces, thin borders, background blur, and diffuse shadows. Standard glass uses the theme’s panel color and glass edge with backdrop blur (20px). The course rail blurs slightly more (24px), and the companion panel sits between them (22px). Dark mode increases panel opacity and reduces reflective edge brightness so the material remains readable.

The welcome surface carries a pale radial and linear tint; course cards blend their course fill toward the panel. Reading panels stay visually quiet. Modal content uses an opaque solid surface, while the backdrop dims and blurs the workspace (5px).

The exact shadow vocabulary lives in `.impeccable/design.json`: theme glass, resting and hovered course cards, primary actions, toasts, dialogs, PDF pages, and the companion. Course cards rise slightly on hover (3px) while their shadow strengthens; other common controls primarily change their surface or border.

**The Surface Before Shadow Rule.** Build depth first with theme surfaces and thin borders. Apply the established diffuse shadows to glass, cards, dialogs, and the companion instead of adding hard outlines or heavy floating chrome.

Motion is small and purposeful. Buttons transition their background, border, shadow, and transform (180ms). Page entry shifts upward into place over a brief ease-out (350ms); it does not fade text away. Yoyo floats gently over a slow cycle (4s), moving upward slightly (7px) and rocking by one degree, with a coordinated soft shadow and occasional blink (6.2s). Preview states add localized ear, mouth, arm, pulse, orbit, or celebration motion. Spinner rotation indicates actual loading.

The global `prefers-reduced-motion: reduce` override disables every animation and transition and restores automatic scrolling. Static expression changes and immediate hover styling remain understandable without movement. Do not rely on motion alone to communicate state.

## Shapes

The shape hierarchy is rounded but restrained: large glass surfaces and dialogs share the broad surface corner; course cards have a slightly tighter corner; buttons, fields, navigation rows, chips, and icon controls use the smaller recorded radii. Most surfaces carry a thin edge (1px). Selection uses fill, foreground, and sometimes a stronger border rather than adding decorative shapes.

Circular dots are small state or course markers. The preview chips are compact rounded rectangles, not pills. The mascot’s pear-shaped body, small fins, ears, reflective highlight, and soft elliptical ground shadow form the distinctive silhouette. The small brand symbol echoes that body and gradient without introducing another illustration style.

## Components

### Buttons

Primary buttons carry the solid iris fill and white label. Secondary buttons use the panel surface and a fine divider-colored edge. Ink buttons anchor the welcome action; destructive buttons are reserved for confirmation. Text buttons expose lighter actions without a container; icon buttons use a compact square hit area (32px), with smaller contextual controls where space is constrained.

Common buttons have a minimum height (39px); the small variant reduces padding and height (33px). Hover changes fill or border. All keyboard-focusable controls share an explicit outline (3px with a 3px offset). Disabled buttons reduce opacity (0.48) and use the disabled cursor. Preserve actual disabled semantics alongside styling.

### Fields and dialogs

Editor inputs, selects, and textareas use a cool canvas backing, fine border, and field radius. Their labels sit above with a compact gap. Textareas can resize vertically and have a useful starting height (120px). The top-bar search field is a separate compact treatment, with a thin iris border on focus within; its input suppresses the general outline because the container carries that focus treatment.

Dialogs use the browser’s modal dialog primitive, an explicit accessible title, a close button, Escape handling, and outside-click dismissal. Destructive dialogs explain the consequence in text. Error and loading feedback remain visible rather than becoming decorative placeholders.

### Navigation and state chips

Primary and course navigation keep icon, label, and optional course marker aligned. Active items combine soft iris fill and iris foreground. The roadmap repeats that selection language, with a filled active node and trailing chevron. Topic tabs use an iris underline and stronger label; their future sections retain planned-stage copy.

Companion state chips are pressed-state buttons for visual expression previews. Their active treatment repeats the iris pair, with a stronger border. They do not activate audio or screen access.

### Cards, source rows, and empty states

Course cards use the course tint, a book icon, course name, real document/topic counts, and one short footer action. The resume row presents the last topic and course without a progress metric. Source rows show the original PDF name, page count, organization method, and source-page location when available.

Empty surfaces explain the next useful action in concise text. The sample course is optional and explicitly labelled. Recent activity lists real local actions; no fabricated activity fills the empty list. Future explanations, lessons, practice, and progress use informative empty states with an explicit stage label. “Not assessed” remains neutral.

### Yoyo and the companion

`src/components/Yoyo.tsx` is a visual-only SVG with a stable `state` and `className` interface. Its view box (240 × 245) contains the original frosted lavender-to-icy-blue creature. Replace its artwork without changing the companion’s window behavior, shared active-topic context, or control semantics. Each instance isolates its gradient identifiers; the SVG has an accessible state label.

The companion opens a frosted panel containing the current course/topic, expression buttons, a workspace action, and microphone/screen-off indicators. Implemented states are idle, listening, thinking, speaking, pointing, celebrating, and unavailable; these are animation previews. The caption and help text make that boundary visible. The hide control appears on character hover or keyboard focus, and the grip remains the window-drag affordance.

**The Visible Truth Rule.** Describe previews as previews. Keep “Animation preview”, “UI preview”, “Mic off”, and “Screen off” visible in their implemented companion contexts, and preserve explicit planned-stage labels on future topic sections.

The sidecar includes self-contained previews of the implemented button variants, field, navigation selection, preview chip, and course card. Its snippets inherit live CSS custom properties with light-theme fallbacks and inline SVG icons; they need no React or icon-package runtime. Screenshot evidence records appearance, while native dragging, always-on-top behavior, and multi-display recovery require runtime verification outside this documentation pass.

## Do's and Don'ts

### Do

- Do use the existing light and dark token pairs, including the darker primary fill and light-theme iris foreground recorded above.
- Do keep the student’s material and next action ahead of decoration, with Yoyo as a small companion rather than a competing interface.
- Do retain visible keyboard focus, text alternatives, selected-state semantics, and the reduced-motion override.
- Do preserve source-linked topic rows, editable notes, real local activity, and clearly labelled optional sample material.
- Do keep the SVG mascot replaceable and its animation states separate from actual tutor capabilities.

### Don’t

- Don’t spread strong gradients or blur behind long-form reading text; the welcome surface and Yoyo already carry the material expression.
- Don’t replace system typography or the pinned iris, lavender, and icy-blue direction with an unrelated visual identity.
- Don’t interpret mascot expressions as live listening, speaking, screen access, or AI activity in Stage 1.
- Don’t add invented mastery scores, learning streaks, or progress claims to fill an empty surface.
- Don’t describe the current desktop layout as mobile-ready or imply that static screenshots verify native window behavior.
