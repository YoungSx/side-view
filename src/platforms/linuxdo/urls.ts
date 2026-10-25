/** linux.do is a stock Discourse forum (native sidebar, no theme layout overrides). */
const LINUXDO_HOSTS = new Set(['linux.do', 'www.linux.do']);

export function isLinuxdoUrl(url: URL): boolean {
  return url.protocol === 'https:' && LINUXDO_HOSTS.has(url.hostname.toLowerCase());
}

// Topic links: /t/:id, /t/:slug/:id (linux.do uses the literal `topic` slug when a title slug is
// absent) and the /:post (number, `last`) deep forms. The topic id is always the last numeric
// segment; slugs are non-numeric.
const TOPIC_PATH = /^\/t\/(?:[^/]+\/)?(\d+)(?:\/(?:\d+|last))?\/?$/i;

/** The topic a Discourse URL points at, or null for every other route. */
export function parseTopicUrl(url: URL): { topicId: string } | null {
  if (!isLinuxdoUrl(url)) return null;
  const match = url.pathname.match(TOPIC_PATH);
  const topicId = match?.[1];
  return topicId ? { topicId } : null;
}
