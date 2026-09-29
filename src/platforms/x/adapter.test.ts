import { beforeEach, describe, expect, it } from 'vitest';
import { byId, byQuery, X_TIMELINE_HTML } from '@/test-utils/dom';
import { XAdapter } from './adapter';

/** resolveIntent only reads `event.target`, so a minimal stub is enough. */
const clickOn = (el: Element): MouseEvent => ({ target: el }) as unknown as MouseEvent;

describe('XAdapter.resolveIntent', () => {
  let adapter: XAdapter;

  beforeEach(() => {
    adapter = new XAdapter();
    document.body.innerHTML = X_TIMELINE_HTML;
  });

  it('opens the tweet status on a plain body click', () => {
    expect(adapter.resolveIntent(clickOn(byId('body')))).toEqual({
      kind: 'status',
      url: 'https://x.com/jack/status/123',
      meta: { handle: 'jack', statusId: '123' },
    });
  });

  it('treats the permalink timestamp as a status', () => {
    const time = byQuery(byId('perma'), 'time');
    expect(adapter.resolveIntent(clickOn(time))?.kind).toBe('status');
  });

  it('classifies hashtag links', () => {
    expect(adapter.resolveIntent(clickOn(byId('tag')))).toMatchObject({
      kind: 'hashtag',
      url: 'https://x.com/hashtag/foo',
    });
  });

  it('classifies search links and captures the query', () => {
    expect(adapter.resolveIntent(clickOn(byId('search')))).toMatchObject({
      kind: 'search',
      meta: { query: 'foo' },
    });
  });

  it('classifies avatars as a profile by handle', () => {
    expect(adapter.resolveIntent(clickOn(byId('avatar')))).toEqual({
      kind: 'profile',
      url: 'https://x.com/jack',
      meta: { handle: 'jack' },
    });
  });

  it('classifies @name profile links', () => {
    expect(adapter.resolveIntent(clickOn(byId('name')))).toMatchObject({
      kind: 'profile',
      meta: { handle: 'jack' },
    });
  });

  it('bails on action buttons so native behaviour is preserved', () => {
    expect(adapter.resolveIntent(clickOn(byId('like')))).toBeNull();
  });

  it('ignores clicks outside the primary column', () => {
    expect(adapter.resolveIntent(clickOn(byId('sidelink')))).toBeNull();
  });

  it('opens the QUOTED tweet, not the enclosing one, on a quote-body click', () => {
    expect(adapter.resolveIntent(clickOn(byId('quote-body')))).toEqual({
      kind: 'status',
      url: 'https://x.com/beth/status/456',
      meta: { handle: 'beth', statusId: '456' },
    });
  });

  it('rejects a cross-origin href matched by the contains-permalink selector', () => {
    // #external is `https://evil.example/status/999` — matches `a[href*="/status/"]` but must never
    // reach the iframe sink.
    expect(adapter.resolveIntent(clickOn(byId('external')))).toBeNull();
  });
});

describe('XAdapter.detailFrameUrl', () => {
  it('bypasses the cached SW document while keeping the canonical URL unchanged', () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'zh';
    try {
      const canonical = 'https://x.com/jack/status/123';
      expect(new XAdapter().detailFrameUrl(canonical)).toBe(`${canonical}?lang=zh`);
      expect(canonical).toBe('https://x.com/jack/status/123');
      expect(new XAdapter().detailFrameUrl('https://x.com/search?q=test&lang=ja')).toBe(
        'https://x.com/search?q=test&lang=ja',
      );
    } finally {
      document.documentElement.lang = originalLang;
    }
  });
});
