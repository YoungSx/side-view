/**
 * The SINGLE source of truth for x.com DOM selectors.
 *
 * Rules: attribute / `data-testid` / `role` selectors ONLY. NEVER the hashed `r-*` / `css-*`
 * atomic classes (regenerated per build), and avoid text/`aria-label` selectors (locale-fragile).
 * These are historically stable (2022→2026) but MUST be re-verified against a live x.com tab — see
 * VERIFICATION.md. `XAdapter.runSelfCheck()` reports which of these currently resolve.
 *
 * Users can patch individual entries at runtime via the `selectorOverrides` setting, so a future
 * X DOM change need not block them on a new release.
 */
export const X_DEFAULT_SELECTORS = {
  /** React app root; persists for the whole app lifetime. */
  appRoot: '#react-root',
  /** Main content region (ARIA role, stable). */
  main: 'main[role="main"]',
  /** Timeline column. */
  primaryColumn: '[data-testid="primaryColumn"]',
  /** Native right column (search/trends) — hidden/replaced in `replace-sidebar` mode. */
  sidebarColumn: '[data-testid="sidebarColumn"]',
  /** Left navigation rail. */
  banner: 'header[role="banner"]',
  /** A tweet article. */
  tweet: 'article[data-testid="tweet"]',
  /** Virtualized timeline cell — NEVER retain references (recycled on scroll). */
  cell: '[data-testid="cellInnerDiv"]',
  /** Tweet body text. */
  tweetText: '[data-testid="tweetText"]',
  /** Permalink anchor wrapping the `<time>`; its href is the canonical status URL. */
  permalink: 'a[href*="/status/"]',
  /** Quoted-tweet block: a role="link" container (NOT a nested article) with its own status link. */
  quote: 'div[role="link"][tabindex="0"]',
  /** Hashtag link. */
  hashtag: 'a[href^="/hashtag/"]',
  /** Search link. */
  search: 'a[href^="/search?q="]',
  /** Avatar container; the testid suffix is the handle. */
  avatar: '[data-testid^="UserAvatar-Container-"]',
} as const;

export type XSelectorKey = keyof typeof X_DEFAULT_SELECTORS;

/**
 * Interactive descendants of a tweet whose native behaviour must be preserved (reply/like/retweet
 * buttons, menus, media players, inputs). A click landing inside one of these is left to X — with
 * the deliberate exception of anchors, which `resolveIntent` classifies before consulting this list.
 */
export const X_INTERACTIVE_WITHIN_TWEET = [
  'button',
  '[role="button"]',
  '[role="menuitem"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  'video',
  '[data-testid="videoPlayer"]',
  '[data-testid="tweetPhoto"]',
  '[data-testid="caret"]',
].join(', ');

/** Merge user overrides over the defaults, ignoring unknown/empty keys. */
export function resolveSelectors(
  overrides: Readonly<Record<string, string>> = {},
): Record<XSelectorKey, string> {
  const merged = { ...X_DEFAULT_SELECTORS } as Record<XSelectorKey, string>;
  for (const key of Object.keys(X_DEFAULT_SELECTORS) as XSelectorKey[]) {
    const value = overrides[key];
    if (typeof value === 'string' && value.trim() !== '') merged[key] = value;
  }
  return merged;
}
