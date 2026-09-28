import type { XSelectorKey } from './selectors';

type Selectors = Record<XSelectorKey, string>;

/** Stable id of the stylesheet we inject inside the framed detail document. */
export const SV_DETAIL_FRAME_STYLE_ID = 'sv-detail-frame-style';

/**
 * CSS injected INSIDE the framed detail page to strip X's own chrome, leaving just the thread.
 * Selectors are best-effort against X's stable test hooks and MUST be verified live (VERIFICATION.md);
 * anything that fails to match simply leaves that chrome visible rather than breaking the frame.
 */
export function buildDetailFrameCss(s: Selectors): string {
  return `
${s.banner} { display: none !important; }
${s.sidebarColumn} { display: none !important; }
${s.main} > div > div { max-width: none !important; }
${s.primaryColumn} { max-width: none !important; width: 100% !important; }
[data-testid="SideNav_NewTweet_Button"],
[data-testid="FloatingActionButtons"] { display: none !important; }
`;
}
