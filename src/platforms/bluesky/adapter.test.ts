import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickAdapter } from '../registry';
import { BlueskyAdapter } from './adapter';

const adapter = new BlueskyAdapter();
const fixture = `<main role="main"><div data-testid="customFeedPage-feed-flatlist"><div>
<div role="link" data-testid="feedItem-by-alice.bsky.social">
<a id="profile" href="/profile/alice.bsky.social">Alice</a>
<a id="time" href="/profile/alice.bsky.social/post/3abc123">1h</a>
<div id="text" data-testid="postText">Post body</div>
<button id="like">Like</button><div role="button" id="media">Image</div>
<a id="external" href="https://example.com/profile/alice/post/3abc123">Card</a>
<a id="suffix" href="/profile/alice.bsky.social/post/3abc123/liked-by">Likes</a>
<div role="link"><a href="/profile/did:plc:bob/post/3def456">2h</a><span id="quote">Quoted</span></div>
<div role="link"><span id="unknown">Unresolved embed</span></div>
</div></div></div></main><nav role="navigation"></nav><div>Right sidebar</div>`;
const intent = (id: string) =>
  adapter.resolveIntent({ target: document.getElementById(id) } as unknown as MouseEvent);
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://bsky.app/'));
  document.body.innerHTML = fixture;
});
afterEach(() => vi.unstubAllGlobals());

describe('Bluesky adapter', () => {
  it('selects only the official HTTPS web app', () => {
    expect(pickAdapter(new URL('https://bsky.app/'))?.id).toBe('bluesky');
    expect(pickAdapter(new URL('https://bsky.app.evil.test/'))).toBeNull();
    expect(pickAdapter(new URL('http://bsky.app/'))).toBeNull();
  });
  it('resolves body, timestamps and quotes to their own canonical post', () => {
    expect(intent('text')).toEqual({
      kind: 'status',
      url: 'https://bsky.app/profile/alice.bsky.social/post/3abc123',
      meta: { handle: 'alice.bsky.social', statusId: '3abc123' },
    });
    expect(intent('time')).toEqual(intent('text'));
    expect(intent('quote')?.url).toBe('https://bsky.app/profile/did:plc:bob/post/3def456');
    expect(intent('unknown')).toBeNull();
  });
  it('preserves controls, media, external cards and unsupported subroutes', () => {
    for (const id of ['like', 'media', 'external', 'suffix']) expect(intent(id)).toBeNull();
    expect(intent('profile')?.kind).toBe('profile');
  });
  it('keeps X overrides isolated and degrades on invalid Bluesky selectors', () => {
    expect(new BlueskyAdapter({ primaryColumn: '#x-only' }).getPrimaryColumn()).not.toBeNull();
    expect(
      new BlueskyAdapter({ 'bluesky.main': '[' }).resolveIntent({
        target: document.getElementById('text'),
      } as unknown as MouseEvent),
    ).toBeNull();
  });
  it('does not add X-specific cache parameters to a Bluesky frame URL', () => {
    expect(adapter.detailFrameUrl('https://bsky.app/profile/alice.bsky.social/post/3abc123')).toBe(
      'https://bsky.app/profile/alice.bsky.social/post/3abc123',
    );
    expect(adapter.columnPosition).toBe('fixed');
  });
});

it('measures the post column instead of the virtual list overlay', () => {
  const list = document.querySelector('[data-testid="customFeedPage-feed-flatlist"]');
  const center = list?.firstElementChild;
  list?.prepend(document.createElement('div'));
  expect(adapter.getPrimaryColumn()).toBe(center);
});
