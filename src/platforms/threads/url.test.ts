import { describe, expect, it } from 'vitest';
import { isThreadsUrl, resolveThreadsUrl } from './url';

const base = new URL('https://www.threads.com/');
describe('Threads URL classification', () => {
  it('normalizes observed post links and leaves media subroutes alone', () => {
    expect(resolveThreadsUrl('/@_yiyi11_/post/Dd3mle_EqpA?x=1#reply', base)).toEqual({
      kind: 'status',
      url: 'https://www.threads.com/@_yiyi11_/post/Dd3mle_EqpA',
      meta: { handle: '_yiyi11_', statusId: 'Dd3mle_EqpA' },
    });
    expect(resolveThreadsUrl('/@clare99.chen/post/Dd3Wx-jE0q8/media', base)).toBeNull();
  });
  it('classifies profiles and the observed topic-search route', () => {
    expect(resolveThreadsUrl('/@clare99.chen', base)?.kind).toBe('profile');
    expect(resolveThreadsUrl('/search?q=hello&serp_type=tags&tag_id=123', base)?.kind).toBe(
      'hashtag',
    );
    expect(resolveThreadsUrl('/search?q=hello', base)?.kind).toBe('search');
  });
  it('leaves login, navigation, cross-origin links and unsafe schemes native', () => {
    for (const url of [
      '/login',
      '/',
      '/search',
      'javascript:alert(1)',
      'https://evil.test/@a/post/123',
      'https://www.threads.com.evil.test/@a/post/123',
      'http://www.threads.com/@a/post/123',
      'https://threads.net/@a/post/123',
    ]) {
      expect(resolveThreadsUrl(url, base)).toBeNull();
    }
  });
  it('supports the legacy domain only within its own origin', () => {
    expect(isThreadsUrl(new URL('https://www.threads.net/'))).toBe(true);
    expect(resolveThreadsUrl('/@a/post/Ab_12', new URL('https://www.threads.net/'))?.url).toBe(
      'https://www.threads.net/@a/post/Ab_12',
    );
  });
});
