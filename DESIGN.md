---
name: side-view
description: A neutral shadcn settings interface for the browser extension.
---

# Design System: side-view

## Overview

The settings page uses shadcn's **new-york / neutral** system, Tailwind layout utilities, and Lucide icons. Familiar form controls, clear section headings, and short explanations support occasional preference changes. The toolbar popup reuses that same system for frequent, in-the-moment changes. Product copy is English.

The product mark uses the approved PNG in `assets/icon/source.png`, exported to
`public/icons/`. It appears in the extension manifest, settings brand link, popup header and
page favicon. Lucide remains the component icon system.

## Surfaces

The extension has two interactive surfaces, split by how often they are used and how long they may
be read:

- **The settings tab** answers "how does this work?". It is a full page, holds every setting, and
  carries the explanatory prose.
- **The toolbar popup** answers "what is happening on this tab, and what do I want to change right
  now?". It is a fixed 360px surface, and its status line is its only explanatory mechanism.

Anything that takes more than a few seconds, or that needs a paragraph of explanation, belongs in
the settings tab. The popup never becomes a miniature settings page.

## Colors

Semantic CSS variables in `src/ui/styles/theme.css` define both themes. That file is the single
token layer: the settings tab and the popup each import it alongside their own layout styles, so a
palette change can never land in one surface and miss the other. Light and dark follow the system
preference. Background, foreground, muted, accent, border, input, and ring roles come from the
neutral palette; destructive colors identify errors. Primary colors emphasize actions and the
detail pane in layout illustrations.

## Typography

Use the default sans-serif stack. The page title is semibold at 1.875rem; section headings are semibold at 1.25rem. Control labels and supporting text use 0.875rem, with muted color and relaxed line height for explanations. Selector JSON uses monospace; width values use tabular numerals.

## Layout

Settings occupy a full browser tab. At the large breakpoint, a sticky 240px left navigation sits beside the content. On narrower screens, navigation moves above the content and its links wrap. Links jump to General, Layout, Platforms, and Advanced on one continuous page.

The main column is centered, capped at 64rem, and uses responsive horizontal padding. Separators divide sections. Layout choices form two columns from the small breakpoint and stack below it; the width form also stacks on narrow screens.

The popup is a single 360px column, its height driven by content and never scrollable. A fixed
header carries the brand mark and a status Badge; four segments follow — the master switch, an
optional reload alert, the placement and width controls, the two reading-habit switches, and a
ghost link out to the settings tab. Separators divide the segments.

Every popup rule follows from one fact: **it closes the moment it loses focus.** So there are no
multi-step flows, no confirmation dialogs, no hover-revealed panels, and no tooltips — anything that
must be understood has to be visible at rest. Equally, every control completes in a single
interaction: the width slider writes through as it moves and there is no Apply button, because a
popup cannot afford a second click to commit a value.

## Elevation & Depth

The page shell uses borders and muted surfaces for separation. Component elevation remains the existing shadcn treatment. Selected layout choices use a primary border and accent background; focus rings communicate keyboard focus.

## Shapes

The base radius is 0.625rem, with related radii derived from the theme. Rounded, bordered layout choices contain small schematic timeline and detail panes. Preserve the component library's existing control shapes.

## Components

- **Buttons:** Existing Button variants provide primary selector saving, an outlined width Apply action, and ghost navigation links.
- **Controls:** Reuse Label, RadioGroup, Switch, Input, Textarea, and Separator from the local shadcn collection. Labels and explanatory text accompany settings.
- **Layout choices:** Label and RadioGroup compositions pair an illustrative pane arrangement with a title and explanation.
- **Advanced:** The official shadcn Accordion reveals selector overrides on demand.
- **Feedback:** The official shadcn Alert presents load and save failures. A status region reports saving and successful saves; invalid fields display nearby messages. Controls are disabled while saving.
- **Access:** A skip link reaches the settings landmark. Inputs retain label associations, descriptions, invalid states, and visible keyboard focus.

### Popup

- **Status:** A Badge in the header states the platform and the derived state as one string
  (`X · Active`, `X · Reload`, `Not here`), so text selection and screen readers get a phrase rather
  than two fragments. A leading dot marks the active state.
- **Placement:** A ToggleGroup gives the two layout modes as a segmented control. It replaces the
  settings page's illustrated RadioGroup cards, which have no room at 360px.
- **Width:** A Slider with a live numeric readout, not the settings page's number input plus Apply.
- **Platform conditionals:** On Threads the placement and width controls are replaced by one muted
  line, because Threads renders into a native column it owns and those settings genuinely do not
  apply. Never leave an inert control on screen.
- **Feedback:** The reload Alert is the only inline explanation the popup needs. It appears when a
  supported page has no content script, and its Reload button is the action that resolves it.
- **Access:** The status Badge is a `role="status"` live region. The Slider forwards
  `aria-labelledby` to its thumb, because Radix leaves a single-value thumb unnamed and the Root is
  a plain span that a `Label` cannot reach.

## Do's and Don'ts

- **Do** use shadcn components, semantic theme colors, Tailwind layout utilities, and Lucide icons.
- **Do** preserve responsive navigation, system theme behavior, and platform-specific explanations.
- **Do** keep the popup to single-click controls and always-visible status; treat its fixed 360px
  width and instant dismissal as hard constraints, not defaults to bend.
- **Don't** introduce an alternative component skin or unrelated visual identity.
- **Don't** substitute custom controls for the existing shadcn primitives.
- **Don't** move a setting into the popup because it is convenient there, or into the settings tab
  because it needs explaining — each belongs where it is used most.
