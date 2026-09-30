import { afterEach, expect, it, vi } from 'vitest';
import { findBlueskyDetailHeader, findXDetailHeader } from '@/platforms/detail-headers';
import { installDetailActions } from './detail-actions';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});
it('appends actions after Bluesky native controls and restores them unchanged on teardown', () => {
  document.body.innerHTML =
    '<main role="main"><div id="header" style="position:sticky;flex-direction:row;min-height:52px"><button id="back">Back</button><div style="flex:1">Post</div><button id="native">Thread preferences</button></div></main>';
  const header = document.getElementById('header');
  const native = document.getElementById('native');
  const before = native?.outerHTML;
  const close = vi.fn();
  let href = 'https://bsky.app/profile/a/post/one';
  cleanup = installDetailActions(document, findBlueskyDetailHeader, {
    href: () => href,
    onClose: close,
  });
  const actions = header?.lastElementChild;
  expect(actions?.hasAttribute('data-sv-detail-actions')).toBe(true);
  expect(actions?.previousElementSibling).toBe(native);
  expect(native?.outerHTML).toBe(before);
  expect(native?.style.position).toBe('');
  const open = actions?.querySelector('a');
  href = 'https://bsky.app/profile/b/post/two';
  open?.addEventListener('click', (e) => e.preventDefault());
  open?.click();
  expect(open?.href).toBe(href);
  actions?.querySelector('button')?.click();
  expect(close).toHaveBeenCalledOnce();
  cleanup();
  cleanup = undefined;
  expect(native?.outerHTML).toBe(before);
  expect(header?.hasAttribute('data-sv-detail-header')).toBe(false);
  expect(document.getElementById('sv-detail-actions-style')).toBeNull();
});
it('reattaches exactly once when X replaces its native header', async () => {
  const html =
    '<div data-testid="primaryColumn"><div id="row" style="flex-direction:row"><div><button data-testid="app-bar-back">Back</button></div><h2>Post</h2></div></div>';
  document.body.innerHTML = html;
  cleanup = installDetailActions(document, findXDetailHeader, {
    href: () => 'https://x.com/a/status/1',
    onClose: vi.fn(),
  });
  expect(document.querySelectorAll('[data-sv-detail-actions]')).toHaveLength(1);
  document.body.innerHTML = html;
  await vi.waitFor(() =>
    expect(document.querySelectorAll('[data-sv-detail-actions]')).toHaveLength(1),
  );
  document.getElementById('row')?.append(document.createElement('span'));
  await vi.waitFor(() =>
    expect(
      document.getElementById('row')?.lastElementChild?.hasAttribute('data-sv-detail-actions'),
    ).toBe(true),
  );
});
it('waits for a late native header instead of manufacturing a second title bar', async () => {
  cleanup = installDetailActions(document, findBlueskyDetailHeader, {
    href: () => 'https://bsky.app/',
    onClose: vi.fn(),
  });
  expect(document.querySelector('[data-sv-detail-actions]')).toBeNull();
  document.body.innerHTML =
    '<main role="main"><div style="position:sticky;flex-direction:row;min-height:52px"><button>Back</button><span>Post</span></div></main>';
  await vi.waitFor(() =>
    expect(document.querySelectorAll('[data-sv-detail-actions]')).toHaveLength(1),
  );
});

it('matches the nearest native painted icon and reacts to platform theme changes', async () => {
  document.body.innerHTML = `<main role="main"><div id="header" style="position:sticky;flex-direction:row;min-height:52px">
    <button><svg><path style="fill:rgb(239, 243, 244)" /></svg></button><div style="flex:1">Post</div>
    <button id="native"><svg><path id="paint" style="fill:none;stroke:rgb(142, 158, 177)" /></svg></button>
  </div></main>`;
  cleanup = installDetailActions(document, findBlueskyDetailHeader, {
    href: () => 'https://bsky.app/',
    onClose: vi.fn(),
  });
  const actions = document.querySelector<HTMLElement>('[data-sv-detail-actions]');
  expect(actions?.style.getPropertyValue('--sv-native-icon-color')).toBe('rgb(142, 158, 177)');
  const paint = document.getElementById('paint');
  paint?.setAttribute('style', 'fill:none;stroke:rgb(66, 87, 108)');
  await vi.waitFor(() =>
    expect(actions?.style.getPropertyValue('--sv-native-icon-color')).toBe('rgb(66, 87, 108)'),
  );
  expect(document.querySelectorAll('[data-sv-detail-actions]')).toHaveLength(1);
});

it('matches the native button hit area, corner radius and icon size', () => {
  document.body.innerHTML =
    '<main role="main"><div id="header" style="position:sticky;flex-direction:row;min-height:52px"><button style="border-radius:18px"><svg><path style="fill:rgb(239,243,244)" /></svg></button><span>Post</span></div></main>';
  const native = document.querySelector('button');
  const svg = native?.querySelector('svg');
  if (!native || !svg) throw new Error('Fixture missing');
  native.getBoundingClientRect = () => ({ width: 36, height: 36 }) as DOMRect;
  svg.getBoundingClientRect = () => ({ width: 20, height: 20 }) as DOMRect;
  cleanup = installDetailActions(document, findBlueskyDetailHeader, {
    href: () => 'https://x.com/a/status/1',
    onClose: vi.fn(),
  });
  const actions = document.querySelector<HTMLElement>('[data-sv-detail-actions]');
  expect(actions?.style.getPropertyValue('--sv-native-button-width')).toBe('36px');
  expect(actions?.style.getPropertyValue('--sv-native-button-height')).toBe('36px');
  expect(actions?.style.getPropertyValue('--sv-native-button-radius')).toBe('18px');
  expect(actions?.style.getPropertyValue('--sv-native-icon-size')).toBe('20px');
});

it('coalesces a burst of subtree mutations into one header reconcile per frame', async () => {
  vi.useFakeTimers();
  document.body.innerHTML =
    '<main role="main"><div id="header" style="position:sticky;flex-direction:row;min-height:52px"><button id="native">Prefs</button><span>Post</span></div></main>';
  // reconcile() calls findHeader exactly once at its top, so a spy header finder counts reconciles.
  const finder = vi.fn(findBlueskyDetailHeader);
  cleanup = installDetailActions(document, finder, {
    href: () => 'https://bsky.app/',
    onClose: vi.fn(),
  });
  // Drain the synchronous first reconcile and every frame its own DOM writes scheduled.
  await vi.runAllTimersAsync();
  finder.mockClear();
  // Five attribute writes outside our own group in one synchronous burst.
  const native = document.getElementById('native');
  for (let i = 0; i < 5; i++) native?.setAttribute('style', `color:rgb(${i},0,0)`);
  // Not synchronous.
  expect(finder).not.toHaveBeenCalled();
  // The observer delivers on a microtask and schedules a frame, but still doesn't reconcile yet.
  await Promise.resolve();
  expect(finder).not.toHaveBeenCalled();
  // Only when the frame fires does the whole burst collapse to a single reconcile.
  await vi.runAllTimersAsync();
  expect(finder).toHaveBeenCalledTimes(1);
});

it('never reconciles after cleanup, even with a frame already pending', async () => {
  vi.useFakeTimers();
  document.body.innerHTML =
    '<main role="main"><div id="header" style="position:sticky;flex-direction:row;min-height:52px"><button id="native">Prefs</button><span>Post</span></div></main>';
  const finder = vi.fn(findBlueskyDetailHeader);
  const teardown = installDetailActions(document, finder, {
    href: () => 'https://bsky.app/',
    onClose: vi.fn(),
  });
  await vi.runAllTimersAsync();
  finder.mockClear();
  // Mutate, let the observer schedule the frame, then tear down before the frame fires.
  document.getElementById('native')?.setAttribute('style', 'color:red');
  await Promise.resolve();
  teardown();
  // The pending frame must see `disposed` and skip its reconcile.
  await vi.runAllTimersAsync();
  expect(finder).not.toHaveBeenCalled();
});
