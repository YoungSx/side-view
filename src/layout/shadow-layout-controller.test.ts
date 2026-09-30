import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentScriptContext } from '#imports';
import { BlueskyAdapter } from '@/platforms/bluesky/adapter';
import { XAdapter } from '@/platforms/x/adapter';
import { ShadowLayoutController } from './shadow-layout-controller';

let layout: ShadowLayoutController;
let ctx: ContentScriptContext;
const host = () => document.querySelector<HTMLElement>('[data-sideview-host]');
const addAnchor = () => {
  const anchor = document.createElement('div');
  anchor.dataset.testid = 'primaryColumn';
  document.body.append(anchor);
  return anchor;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1400);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    right: 600,
    width: 600,
  } as DOMRect);
  ctx = new ContentScriptContext('layout-test');
  layout = new ShadowLayoutController(ctx, new XAdapter(), 600);
});
afterEach(() => {
  layout.detach();
  ctx.abort();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('initializes closed and never mounts on late anchors, route reconciliation or settings changes', async () => {
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  addAnchor();
  layout.setMode('insert-column');
  layout.setWidth(500);
  layout.reattachIfDetached();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
  expect(document.body.classList.contains('sv-active')).toBe(false);
});

it('restores a removed host and an atomically replaced anchor without remounting content', async () => {
  const anchor = addAnchor();
  const mount = vi.fn((container: HTMLElement) => {
    container.textContent = 'Open thread';
  });
  await layout.initialize('replace-sidebar', { onMount: mount, onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  const original = host();
  expect(original).not.toBeNull();
  original?.remove();
  expect(layout.isColumnVisible()).toBe(false);
  await vi.waitFor(() => expect(host()).toBe(original));
  const replacement = anchor.cloneNode() as HTMLElement;
  document.body.replaceChildren(replacement);
  await vi.waitFor(() => expect(replacement.nextElementSibling).toBe(original));
  expect(mount).toHaveBeenCalledOnce();
});

it('restores native layout without an anchor and stops observing on invalidation', async () => {
  const anchor = addAnchor();
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  anchor.remove();
  await vi.waitFor(() => expect(host()).toBeNull());
  expect(document.body.classList.contains('sv-active')).toBe(false);
  ctx.abort();
  addAnchor();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
});

it('close restores the page and stays closed through DOM changes, then reopens on demand', async () => {
  addAnchor();
  const remove = vi.fn();
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: remove });
  expect(layout.open()).toBe(true);
  layout.close();
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
  expect(document.body.className).toBe('');
  expect(remove).toHaveBeenCalledOnce();
  document.body.replaceChildren();
  const replacement = addAnchor();
  layout.setMode('insert-column');
  layout.reattachIfDetached();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(host()).toBeNull();
  expect(document.body.className).toBe('');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  expect(layout.open()).toBe(false);
  expect(host()).toBeNull();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    right: 600,
    width: 600,
  } as DOMRect);
  expect(layout.open()).toBe(true);
  expect(replacement.nextElementSibling).toBe(host());
  expect(document.body.classList.contains('sv-active')).toBe(true);
  vi.unstubAllGlobals();
});

it('fits the right column into remaining viewport space and updates on resize', async () => {
  const anchor = addAnchor();
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ right: 900, width: 600 } as DOMRect);
  const viewport = vi.spyOn(document.documentElement, 'clientWidth', 'get');
  viewport.mockReturnValue(1400);
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  expect(host()?.style.width).toBe('500px');
  viewport.mockReturnValue(1200);
  window.dispatchEvent(new Event('resize'));
  expect(host()?.style.width).toBe('300px');
  viewport.mockReturnValue(1800);
  window.dispatchEvent(new Event('resize'));
  expect(host()?.style.width).toBe('600px');
  expect(anchor.style.width).toBe('');
});

it('keeps the compact navigation preference when detail closes, and removes it when disabled', async () => {
  addAnchor();
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  layout.setCompactNavigation(true);
  expect(document.body.classList.contains('sv-compact-nav')).toBe(true);
  expect(document.getElementById('sv-navigation-style')).not.toBeNull();
  expect(layout.open()).toBe(true);
  layout.close();
  expect(host()).toBeNull();
  expect(document.body.classList.contains('sv-active')).toBe(false);
  expect(document.body.classList.contains('sv-compact-nav')).toBe(true);
  layout.setCompactNavigation(false);
  expect(document.body.classList.contains('sv-compact-nav')).toBe(false);
  expect(document.getElementById('sv-navigation-style')).toBeNull();
  layout.setCompactNavigation(true);
  ctx.abort();
  expect(document.body.classList.contains('sv-compact-nav')).toBe(false);
  expect(document.getElementById('sv-navigation-style')).toBeNull();
});

it('rolls back a failed mount and remains closed after disposal', async () => {
  const anchor = addAnchor();
  await layout.initialize('replace-sidebar', {
    onMount: () => {
      throw new Error('render failed');
    },
    onRemove: vi.fn(),
  });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(layout.open()).toBe(false);
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
  expect(document.body.classList.contains('sv-active')).toBe(false);
  expect(error).toHaveBeenCalled();
  ctx.abort();
  anchor.after(document.createElement('div'));
  expect(layout.open()).toBe(false);
});

it('does not resurrect a view if context invalidates during asynchronous preparation', async () => {
  addAnchor();
  const preparation = layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  ctx.abort();
  await preparation;
  expect(layout.open()).toBe(false);
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
});

it('positions a fixed column from the content geometry and reserves a retained native sidebar', async () => {
  document.body.innerHTML =
    '<main role="main"><div data-testid="feed-flatlist"><div><div data-testid="feedItem-by-alice"></div></div></div></main><nav role="navigation"></nav><div id="native-right"></div>';
  const adapter = new BlueskyAdapter();
  const primary = adapter.getPrimaryColumn();
  const sidebar = adapter.getSidebarColumn();
  if (!primary || !sidebar) throw new Error('Bluesky fixture missing');
  Object.defineProperty(primary, 'getBoundingClientRect', {
    value: () => ({ right: 800, width: 600 }),
    configurable: true,
  });
  Object.defineProperty(sidebar, 'getBoundingClientRect', {
    value: () => ({ right: 1100, width: 300 }),
    configurable: true,
  });
  layout = new ShadowLayoutController(ctx, adapter, 600);
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  expect(host()?.style.position).toBe('fixed');
  expect(host()?.style.left).toBe('800px');
  layout.setMode('insert-column');
  expect(host()?.style.left).toBe('1100px');
  expect(host()?.style.width).toBe('300px');
});

it('holds a fixed column in place instead of snapping to the left edge when the timeline is momentarily unmeasurable', async () => {
  document.body.innerHTML =
    '<main role="main"><div data-testid="feed-flatlist"><div><div data-testid="feedItem-by-alice"></div></div></div></main><nav role="navigation"></nav><div id="native-right"></div>';
  const adapter = new BlueskyAdapter();
  const primary = adapter.getPrimaryColumn();
  if (!primary) throw new Error('Bluesky fixture missing');
  const rect = vi
    .spyOn(primary, 'getBoundingClientRect')
    .mockReturnValue({ right: 800, width: 600 } as DOMRect);
  layout = new ShadowLayoutController(ctx, adapter, 600);
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  expect(host()?.style.left).toBe('800px');
  // Mid-navigation the feed column is torn down and reads zero-width: the column must NOT jump to 0.
  rect.mockReturnValue({ right: 0, width: 0 } as DOMRect);
  window.dispatchEvent(new Event('resize'));
  expect(host()?.style.left).toBe('800px');
  // Once the feed is measurable again it re-tracks the new right edge.
  rect.mockReturnValue({ right: 900, width: 600 } as DOMRect);
  window.dispatchEvent(new Event('resize'));
  expect(host()?.style.left).toBe('900px');
});

it.each([
  ['rgb(0, 0, 0)', 'rgb(231, 233, 234)'],
  ['rgb(21, 32, 43)', 'rgb(231, 233, 234)'],
  ['rgb(255, 255, 255)', 'rgb(15, 20, 25)'],
])('tints the column with the host page surface %s', async (background, foreground) => {
  addAnchor();
  document.body.style.backgroundColor = background;
  document.body.style.color = foreground;
  await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
  expect(layout.open()).toBe(true);
  expect(host()?.style.getPropertyValue('--sv-surface')).toBe(background);
  expect(host()?.style.getPropertyValue('--sv-on-surface')).toBe(foreground);
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
});

it('skips transparent body backgrounds and samples the opaque root background', async () => {
  addAnchor();
  document.body.style.backgroundColor = 'rgba(255, 255, 255, 0)';
  document.documentElement.style.backgroundColor = 'rgb(0, 0, 0)';
  try {
    await layout.initialize('replace-sidebar', { onMount: vi.fn(), onRemove: vi.fn() });
    expect(layout.open()).toBe(true);
    expect(host()?.style.getPropertyValue('--sv-surface')).toBe('rgb(0, 0, 0)');
  } finally {
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';
  }
});
