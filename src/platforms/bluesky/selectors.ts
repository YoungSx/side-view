/** Verified against Bluesky's public Discover DOM and the official social-app source. */
export const BLUESKY_SELECTORS = {
  main: 'main[role="main"]',
  primaryColumn:
    'main [data-testid$="-flatlist"] > div, main #content > div, main [data-testid="notifsFeed"] > div, main [data-testid="searchScreen"] [style*="max-width"]',
  sidebarColumn: 'main ~ nav[role="navigation"] + div',
  navigation: 'main ~ nav[role="navigation"]',
  post: '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"], [data-testid="searchScreen"] div[role="link"]:has(a[href^="/profile/"][href*="/post/"])',
  permalink: 'a[href^="/profile/"][href*="/post/"]',
} as const;

export type BlueskySelectorKey = keyof typeof BLUESKY_SELECTORS;
export function resolveBlueskySelectors(overrides: Readonly<Record<string, string>>) {
  const result: Record<BlueskySelectorKey, string> = { ...BLUESKY_SELECTORS };
  for (const key of Object.keys(result) as BlueskySelectorKey[]) {
    const value = overrides[`bluesky.${key}`];
    if (value?.trim()) result[key] = value;
  }
  return result;
}
