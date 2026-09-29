import {
  SV_ACTIVE_CLASS,
  SV_COMPACT_NAV_CLASS,
  SV_HOST_ATTR,
  SV_MIN_VIEWPORT_PX,
} from '@/core/style-ids';
import type { LayoutMode } from '@/core/types';
import type { XSelectorKey } from './selectors';

type Selectors = Record<XSelectorKey, string>;

/** Retain native links, accessible names, unread badges and account menu; hide only labels. */
export function buildCompactNavigationCss(s: Selectors): string {
  const banner = `body.${SV_COMPACT_NAV_CLASS} ${s.banner}`;
  return `
@media (min-width: 700px) {
  ${banner} { flex: 0 0 88px !important; width: 88px !important; }
  ${banner} > div, ${banner} > div > div, ${banner} > div > div > div {
    width: 88px !important;
  }
  ${banner} nav { align-items: center !important; }
  ${banner} nav :is(a, button) { width: fit-content !important; }
  ${banner} nav :is(a, button) > div > div[dir] { display: none !important; }
  ${banner} [data-testid="SideNav_NewTweet_Button"] {
    width: 50px !important; min-width: 50px !important; height: 50px !important;
    align-self: center !important;
  }
  ${banner} [data-testid="SideNav_NewTweet_Button"] > div { display: none !important; }
  ${banner} [data-testid="SideNav_NewTweet_Button"]::after {
    content: '+'; font-size: 30px; line-height: 1;
  }
  ${banner} [data-testid="SideNav_AccountSwitcher_Button"] {
    width: 64px !important; align-self: center !important;
  }
  ${banner} [data-testid="SideNav_AccountSwitcher_Button"] > div:not(:has([data-testid^="UserAvatar-Container-"])) {
    display: none !important;
  }
}
`;
}

/**
 * Host-page CSS for a layout mode. Attribute selectors + `!important` only (never hashed classes),
 * all gated behind `body.sv-active` so the effect is cleanly reversible and mode-switchable. A
 * min-viewport guard mirrors X's own ~1050px breakpoint, below which it hides its sidebar; the JS
 * click gate uses the SAME constant so interception is suppressed wherever the column is hidden.
 */
export function buildLayoutCss(mode: LayoutMode, s: Selectors): string {
  const common = `
body.${SV_ACTIVE_CLASS} ${s.primaryColumn} {
  flex: 0 0 auto !important;
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
