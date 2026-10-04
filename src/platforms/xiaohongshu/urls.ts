/** Exact user profiles only; nested profile-note paths are handled separately. */
export function isProfileUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.hostname === 'www.xiaohongshu.com' &&
    /^\/user\/profile\/[a-f\d]{24}\/?$/i.test(url.pathname)
  );
}
