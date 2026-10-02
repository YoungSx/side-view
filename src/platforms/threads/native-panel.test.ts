import * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PANEL_ATTR } from './native-column-box';
import { supportsStandalone, ThreadsNativePanel } from './native-panel';
import { findDispatcher, nativeContexts } from './native-runtime';

vi.mock('./native-runtime', () => ({ findDispatcher: vi.fn(), nativeContexts: vi.fn() }));
let panel: ThreadsNativePanel;
let source: HTMLElement;
let modules: Record<string, unknown>;
const render = vi.fn(),
  unmount = vi.fn(),
  preload = vi.fn();
const rect = (over: Partial<DOMRect> = {}) =>
  ({
    left: 200,
    right: 840,
    top: 100,
    bottom: 1034,
    width: 640,
    height: 934,
    x: 200,
    y: 100,
    ...over,
  }) as DOMRect;
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.threads.com/activity'));
  vi.stubGlobal('innerWidth', 1800);
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: function (this: Element) {
      return this.isConnected && !this.closest('[hidden]');
    },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect());
  document.body.innerHTML =
    '<div id="barcelona-page-layout"><div data-column-scrollable></div></div>';
  source = document.querySelector('[data-column-scrollable]') as HTMLElement;
  const contexts = new Map();
  modules = {
    react: React,
    ReactDOM: { createRoot: () => ({ render, unmount }), flushSync: (fn: () => void) => fn() },
    'BarcelonaRoutedColumn.react': () => null,
  };
  for (const name of [
    'CometRouteStoreContext',
    'CometRouterUIComponentContext',
    'CometRouterDispatcherContext',
  ]) {
    const context = React.createContext(null);
    modules[name] = context;
    contexts.set(context, {});
  }
  vi.mocked(nativeContexts).mockReturnValue(contexts);
  vi.mocked(findDispatcher).mockReturnValue({ go: vi.fn(), preloadRouteCode: preload });
  vi.stubGlobal('require', (name: string) => modules[name]);
  render.mockReset();
  unmount.mockReset();
  preload.mockReset();
  panel = new ThreadsNativePanel();
});
afterEach(() => {
  panel.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, 'checkVisibility');
});

/** Give the page a real native column for the replica to be measured against. */
function addDeckColumn(box: Partial<DOMRect> = {}) {
  const deck = document.createElement('div');
  deck.setAttribute('data-deck-column', '');
  deck.getBoundingClientRect = () => rect(box);
  document.querySelector('#barcelona-page-layout')?.append(deck);
  return deck;
}

it.each([
  '/',
  '/activity',
  '/following/',
  '/saved',
  '/liked',
  '/for_you',
  '/archive',
  '/custom_feed/123',
  '/search?q=tag&serp_type=tags',
  '/search',
  '/@alice',
  '/@alice/',
])('supports the standalone source %s', (path) =>
  expect(supportsStandalone(new URL(path, location.origin))).toBe(true),
);
it.each(['/messages', '/settings', '/@alice/followers', '/custom_feed/123/edit'])(
  'does not take over %s',
  (path) => expect(supportsStandalone(new URL(path, location.origin))).toBe(false),
);

it('preloads the column code once without changing the page', () => {
  panel.prepare();
  panel.prepare();
  expect(preload).toHaveBeenCalledExactlyOnceWith('/');
  expect(location.pathname).toBe('/activity');
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('joins the page flex row and leaves no styling of its own behind', () => {
  addDeckColumn();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const page = document.querySelector('#barcelona-page-layout');
  const host = document.querySelector(`[${PANEL_ATTR}]`);
  expect(host?.parentElement).toBe(page);
  expect(page?.lastElementChild).toBe(host);
  // Nothing may write to the page or inject stylesheets: that is what produced the
  // stray outer scrollbar. The host must also never pose as a column Threads owns.
  expect(page?.hasAttribute('style')).toBe(false);
  expect(document.querySelector('style')).toBeNull();
  expect(host?.hasAttribute('data-deck-column')).toBe(false);
});

it('measures the replica box from a live native column instead of hardcoding it', () => {
  addDeckColumn({ width: 514, right: 714 });
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const host = document.querySelector<HTMLElement>(`[${PANEL_ATTR}]`);
  expect(host?.style.width).toBe('514px');
  expect(host?.style.height).toBe('934px');
  // A grid track, not a flex column: a flex child keeps its min-height:auto floor and
  // would grow past the box and be clipped rather than scroll.
  expect(host?.style.display).toBe('grid');
  expect(host?.style.gridTemplateRows).toBe('minmax(0,1fr)');
  expect(host?.style.overflow).toBe('hidden');
  expect(host?.style.position).toBe('');
});

it('keeps the native column model on a route that scrolls as a document', () => {
  // Profile and search pages scroll as a document, but a native column is still
  // viewport-tall and scrolls inside itself. Growing with content instead would leave
  // the two columns on different scroll models.
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const host = document.querySelector<HTMLElement>(`[${PANEL_ATTR}]`);
  expect(host?.style.width).toBe('640px');
  expect(host?.style.height).toBe(`${document.documentElement.clientHeight}px`);
  expect(host?.style.overflow).toBe('hidden');
  expect(host?.style.marginInlineStart).toBe('12px');
});

it('reuses a single native root across switches and detaches cleanly on close', () => {
  addDeckColumn();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const host = document.querySelector(`[${PANEL_ATTR}]`);
  expect(panel.open(source, '/@b/post/two')).toBe(true);
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBe(host);
  expect(render).toHaveBeenCalledTimes(2);
  expect(location.pathname).toBe('/activity');
  panel.close();
  expect(unmount).toHaveBeenCalledOnce();
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('leaves the click native when modules or route context are missing', () => {
  modules['BarcelonaRoutedColumn.react'] = null;
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  modules['BarcelonaRoutedColumn.react'] = () => null;
  vi.mocked(nativeContexts).mockReturnValue(new Map());
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(render).not.toHaveBeenCalled();
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('refuses to open when there is nothing measurable to replicate', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    rect({ width: 0, right: 0, left: 0 }),
  );
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(render).not.toHaveBeenCalled();
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('closes rather than letting Threads clip an over-wide replica', () => {
  addDeckColumn();
  vi.stubGlobal('innerWidth', 500);
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('rolls back when mounting throws', () => {
  addDeckColumn();
  render.mockImplementationOnce(() => {
    throw new Error('Site changed');
  });
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('closes on navigation, removal, or a viewport that no longer fits', () => {
  addDeckColumn();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  vi.stubGlobal('location', new URL('https://www.threads.com/saved'));
  panel.reconcile();
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();

  vi.stubGlobal('location', new URL('https://www.threads.com/activity'));
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  source.remove();
  panel.reconcile();
  expect(document.querySelector(`[${PANEL_ATTR}]`)).toBeNull();
});

it('re-measures on resize instead of keeping a stale column width', () => {
  const deck = addDeckColumn();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const host = document.querySelector<HTMLElement>(`[${PANEL_ATTR}]`);
  expect(host?.style.width).toBe('640px');
  deck.getBoundingClientRect = () => rect({ width: 420, right: 620 });
  window.dispatchEvent(new Event('resize'));
  expect(host?.style.width).toBe('420px');
});

it('opens on a profile route once the column code has been preloaded', () => {
  vi.stubGlobal('location', new URL('https://www.threads.com/@alice'));
  panel.prepare();
  expect(preload).toHaveBeenCalledOnce();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  expect(document.querySelector(`[${PANEL_ATTR}]`)).not.toBeNull();
});
