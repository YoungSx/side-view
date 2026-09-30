import { describe, expect, it } from 'vitest';
import { isPingResult, isPopupCommand, platformForUrl } from '@/core/messaging';
import { deriveTabState } from './tab-state';

describe('platformForUrl', () => {
  it('recognises every platform the manifest declares, and nothing else', () => {
    expect(platformForUrl('https://x.com/home')).toBe('x');
    expect(platformForUrl('https://twitter.com/jack')).toBe('x');
    expect(platformForUrl('https://bsky.app/profile/beth.bsky.social')).toBe('bluesky');
    expect(platformForUrl('https://www.threads.net/@jack')).toBe('threads');
    expect(platformForUrl('https://example.com/')).toBeNull();
    // A lookalike host must not pass the suffix test.
    expect(platformForUrl('https://notx.com/')).toBeNull();
    expect(platformForUrl('not a url')).toBeNull();
  });
});

describe('isPingResult', () => {
  it('accepts only the two shapes the content scripts send', () => {
    expect(isPingResult({ kind: 'unsupported' })).toBe(true);
    expect(isPingResult({ kind: 'ready', platform: 'x', columnOpen: false })).toBe(true);
    expect(isPingResult({ kind: 'ready', platform: 'mastodon', columnOpen: false })).toBe(false);
    expect(isPingResult({ kind: 'ready', platform: 'x' })).toBe(false);
    expect(isPingResult(undefined)).toBe(false);
  });
});

describe('isPopupCommand', () => {
  it('ignores messages that are not ours', () => {
    expect(isPopupCommand({ type: 'sv:ping' })).toBe(true);
    expect(isPopupCommand({ type: 'sv:somethingElse' })).toBe(false);
    expect(isPopupCommand(null)).toBe(false);
  });
});

describe('deriveTabState', () => {
  const ready = { kind: 'ready', platform: 'x', columnOpen: false } as const;

  it('is active when the engine answers and the extension is on', () => {
    expect(deriveTabState({ ...ready, columnOpen: true }, 'https://x.com/home', true)).toEqual({
      kind: 'active',
      platform: 'x',
      columnOpen: true,
    });
  });

  it('is inactive when the engine answers but the extension is off', () => {
    expect(deriveTabState(ready, 'https://x.com/home', false)).toEqual({
      kind: 'inactive',
      platform: 'x',
    });
  });

  it('asks for a reload only when a supported page has no listener', () => {
    expect(deriveTabState({ kind: 'unsupported' }, 'https://bsky.app/', true)).toEqual({
      kind: 'needs-reload',
      platform: 'bluesky',
    });
    // Off plus no listener is the expected steady state, not a broken tab.
    expect(deriveTabState({ kind: 'unsupported' }, 'https://bsky.app/', false)).toEqual({
      kind: 'inactive',
      platform: 'bluesky',
    });
  });

  it('is unsupported everywhere else, including an unreadable URL', () => {
    expect(deriveTabState({ kind: 'unsupported' }, 'https://example.com/', true)).toEqual({
      kind: 'unsupported',
    });
    expect(deriveTabState({ kind: 'unsupported' }, null, true)).toEqual({ kind: 'unsupported' });
  });
});
