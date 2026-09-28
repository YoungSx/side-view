import { SV_ACTIVE_CLASS, SV_HOST_ATTR, SV_MIN_VIEWPORT_PX } from '@/core/style-ids';
import type { LayoutMode } from '@/core/types';
import type { XSelectorKey } from './selectors';

type Selectors = Record<XSelectorKey, string>;

/**
 * Host-page CSS for a layout mode. Attribute selectors + `!important` only (never hashed classes),
 * all gated behind `body.sv-active` so the effect is cleanly reversible and mode-switchable. A
 * min-viewport guard mirrors X's own ~1050px breakpoint, below which it hides its sidebar; the JS
 * click gate uses the SAME constant so interception is suppressed wherever the column is hidden.
 */
export function buildLayoutCss(mode: LayoutMode, s: Selectors): string {
  const common = `
body.${SV_ACTIVE_CLASS} ${s.main} > div > div { max-width: none !important; }
body.${SV_ACTIVE_CLASS} ${s.primaryColumn} {
  max-width: none !important;
  width: auto !important;
  flex: 1 1 600px !important;
}
@media (max-width: ${SV_MIN_VIEWPORT_PX - 1}px) {
  body.${SV_ACTIVE_CLASS} [${SV_HOST_ATTR}] { display: none !important; }
}
`;
  if (mode === 'replace-sidebar') {
    return `${common}body.${SV_ACTIVE_CLASS} ${s.sidebarColumn} { display: none !important; }\n`;
  }
  // insert-column: keep the native sidebar; DOM source order places our host between the columns.
  return common;
}
