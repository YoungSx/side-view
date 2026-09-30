---
name: side-view
description: A neutral shadcn settings interface for the browser extension.
---

# Design System: side-view

## Overview

The settings page uses shadcn's **new-york / neutral** system, Tailwind layout utilities, and Lucide icons. Familiar form controls, clear section headings, and short explanations support occasional preference changes. Product copy is English.

The product mark uses the approved PNG in `assets/icon/source.png`, exported to
`public/icons/`. It appears in the extension manifest, settings brand link and
page favicon. Lucide remains the component icon system.

## Colors

Semantic CSS variables in `src/entrypoints/options/style.css` define both themes. Light and dark follow the system preference. Background, foreground, muted, accent, border, input, and ring roles come from the neutral palette; destructive colors identify errors. Primary colors emphasize actions and the detail pane in layout illustrations.

## Typography

Use the default sans-serif stack. The page title is semibold at 1.875rem; section headings are semibold at 1.25rem. Control labels and supporting text use 0.875rem, with muted color and relaxed line height for explanations. Selector JSON uses monospace; width values use tabular numerals.

## Layout

Settings occupy a full browser tab. At the large breakpoint, a sticky 240px left navigation sits beside the content. On narrower screens, navigation moves above the content and its links wrap. Links jump to General, Layout, Platforms, and Advanced on one continuous page.

The main column is centered, capped at 64rem, and uses responsive horizontal padding. Separators divide sections. Layout choices form two columns from the small breakpoint and stack below it; the width form also stacks on narrow screens.

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

## Do's and Don'ts

- **Do** use shadcn components, semantic theme colors, Tailwind layout utilities, and Lucide icons.
- **Do** preserve responsive navigation, system theme behavior, and platform-specific explanations.
- **Don't** introduce an alternative component skin or unrelated visual identity.
- **Don't** substitute custom controls for the existing shadcn primitives.
