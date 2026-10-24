/** nodeloc.com is a Discourse forum wearing a custom "community card" theme. */
const NODELOC_HOSTS = new Set(['www.nodeloc.com', 'nodeloc.com']);

export function isNodelocUrl(url: URL): boolean {
  return url.protocol === 'https:' && NODELOC_HOSTS.has(url.hostname.toLowerCase());
}

// Topic links: /t/:id, /t/:slug/:id and the /:post (number, `last`) deep forms.
// The topic id is always the last numeric path segment; slugs are non-numeric.
const TOPIC_PATH = /^\/t\/(?:[^/]+\/)?(\d+)(?:\/(?:\d+|last))?\/?$/i;

/** The topic a Discourse URL points at, or null for every other route. */
export function parseTopicUrl(url: URL): { topicId: string } | null {
  if (!isNodelocUrl(url)) return null;
  const match = url.pathname.match(TOPIC_PATH);
  const topicId = match?.[1];
  return topicId ? { topicId } : null;
}
