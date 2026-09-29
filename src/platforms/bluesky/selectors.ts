/** Verified against Bluesky's public Discover DOM and the official social-app source. */
export const BLUESKY_SELECTORS = {
  main: 'main[role="main"]',
  primaryColumn: 'main [data-testid$="-flatlist"] > div, main #content > div',
  sidebarColumn: 'main ~ nav[role="navigation"] + div',
  navigation: 'main ~ nav[role="navigation"]',
  post: '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]',
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
