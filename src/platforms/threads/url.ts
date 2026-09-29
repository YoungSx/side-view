import type { DetailIntent } from '@/core/types';

const HOSTS = new Set(['threads.com', 'www.threads.com', 'threads.net', 'www.threads.net']);
export function isThreadsUrl(url: URL): boolean {
  return url.protocol === 'https:' && HOSTS.has(url.hostname);
}

/** Only same-origin canonical destinations can enter the detail iframe. */
export function resolveThreadsUrl(href: string, base: URL): DetailIntent | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (!isThreadsUrl(base) || !isThreadsUrl(url) || url.origin !== base.origin) return null;
  const status = url.pathname.match(/^\/@([A-Za-z0-9._]+)\/post\/([A-Za-z0-9_-]+)\/?$/);
  if (status?.[1] && status[2]) {
    return {
      kind: 'status',
      url: `${url.origin}/@${status[1]}/post/${status[2]}`,
      meta: { handle: status[1], statusId: status[2] },
    };
  }
  const profile = url.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);
  if (profile?.[1])
    return { kind: 'profile', url: `${url.origin}/@${profile[1]}`, meta: { handle: profile[1] } };
  if (url.pathname === '/search' && url.searchParams.has('q')) {
    return {
      kind: url.searchParams.get('serp_type') === 'tags' ? 'hashtag' : 'search',
      url: url.href,
      meta: { query: url.searchParams.get('q') ?? undefined },
    };
  }
  return null;
}
