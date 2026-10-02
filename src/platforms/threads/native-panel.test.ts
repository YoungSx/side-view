import * as React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { supportsStandalone, ThreadsNativePanel } from './native-panel';
import { findDispatcher, nativeContexts } from './native-runtime';

vi.mock('./native-runtime', () => ({ findDispatcher: vi.fn(), nativeContexts: vi.fn() }));
let panel: ThreadsNativePanel;
let source: HTMLElement;
let modules: Record<string, unknown>;
const render = vi.fn(),
  unmount = vi.fn(),
  preload = vi.fn();
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.threads.com/activity'));
  vi.stubGlobal('innerWidth', 1800);
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: function (this: Element) {
      return this.isConnected && !this.closest('[hidden]');
    },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 200,
    right: 840,
    width: 640,
  } as DOMRect);
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
])('supports the standalone source %s', (path) =>
  expect(supportsStandalone(new URL(path, location.origin))).toBe(true),
);
it.each(['/messages', '/@alice', '/search', '/settings', '/custom_feed/123/edit'])(
  'does not take over %s',
  (path) => expect(supportsStandalone(new URL(path, location.origin))).toBe(false),
);
it('preloads code once without changing the page or creating a column', () => {
  panel.prepare();
  panel.prepare();
  expect(preload).toHaveBeenCalledExactlyOnceWith('/');
  expect(location.pathname).toBe('/activity');
  expect(document.querySelector('aside')).toBeNull();
});
it('reuses a single native root for switches and restores layout when closed', () => {
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  const host = document.querySelector('aside');
  expect(host?.style.left).toBe('856px');
  expect(panel.open(source, '/@b/post/two')).toBe(true);
  expect(document.querySelector('aside')).toBe(host);
  expect(render).toHaveBeenCalledTimes(2);
  expect(location.pathname).toBe('/activity');
  panel.close();
  expect(unmount).toHaveBeenCalledOnce();
  expect(document.querySelector('aside')).toBeNull();
  expect(document.querySelector('[data-sideview-threads-source]')).toBeNull();
});
it('leaves the original click available when native modules or route context are missing', () => {
  modules['BarcelonaRoutedColumn.react'] = null;
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  modules['BarcelonaRoutedColumn.react'] = () => null;
  vi.mocked(nativeContexts).mockReturnValue(new Map());
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(render).not.toHaveBeenCalled();
  expect(document.querySelector('aside')).toBeNull();
});
it('rolls back layout when there is insufficient room or mounting throws', () => {
  vi.stubGlobal('innerWidth', 1300);
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  vi.stubGlobal('innerWidth', 1800);
  render.mockImplementationOnce(() => {
    throw new Error('Site changed');
  });
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(document.querySelector('aside')).toBeNull();
  expect(document.querySelector('[data-sideview-threads-source]')).toBeNull();
});
it('closes on source navigation, removal, or a narrow viewport', () => {
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  vi.stubGlobal('location', new URL('https://www.threads.com/saved'));
  panel.reconcile();
  expect(document.querySelector('aside')).toBeNull();
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  vi.stubGlobal('innerWidth', 1000);
  window.dispatchEvent(new Event('resize'));
  expect(document.querySelector('aside')).toBeNull();
});

it('reserves the visible native navigation instead of overlapping it on smaller desktops', () => {
  const nav = document.createElement('a');
  nav.href = '/activity';
  document.body.prepend(nav);
  Object.defineProperty(nav, 'getBoundingClientRect', {
    value: () => ({ right: 215, width: 200 }),
  });
  vi.stubGlobal('innerWidth', 1400);
  expect(panel.open(source, '/@a/post/one')).toBe(false);
  expect(document.querySelector('aside')).toBeNull();
  vi.stubGlobal('innerWidth', 1600);
  Object.defineProperty(source, 'getBoundingClientRect', {
    value: () => ({ left: 260, right: 900, width: 640 }),
  });
  expect(panel.open(source, '/@a/post/one')).toBe(true);
  expect(document.querySelector('style')?.textContent).toContain('padding-inline-start:231px');
});
