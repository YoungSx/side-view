import type * as React from 'react';
import { findDispatcher, nativeContexts } from './native-runtime';

const SOURCE = 'data-sideview-threads-source';
const WIDTH = 640;
const GAP = 16;

export function supportsStandalone(url: URL): boolean {
  return (
    /^\/(?:activity|following|saved|liked|for_you|archive)\/?$/.test(url.pathname) ||
    /^\/custom_feed\/[^/]+\/?$/.test(url.pathname) ||
    (url.pathname.replace(/\/$/, '') === '/search' && !!url.searchParams.get('q'))
  );
}

function load(name: string): unknown {
  try {
    return (window as unknown as { require?: (name: string) => unknown }).require?.(name);
  } catch {
    return null;
  }
}

interface NativeRoot {
  render(node: React.ReactNode): void;
  unmount(): void;
}
interface NativeDOM {
  createRoot(element: HTMLElement): NativeRoot;
  flushSync(fn: () => void): void;
}

/** Ephemeral native renderer for standalone routes. Nothing is pinned or saved to the account. */
export class ThreadsNativePanel {
  private root: NativeRoot | null = null;
  private host: HTMLElement | null = null;
  private page: HTMLElement | null = null;
  private source: HTMLElement | null = null;
  private style: HTMLStyleElement | null = null;
  private route = '';
  private preparedPage: HTMLElement | null = null;

  contains(element: Element): boolean {
    return this.host?.contains(element) ?? false;
  }

  prepare(): void {
    if (!supportsStandalone(new URL(location.href))) return;
    const page = [...document.querySelectorAll<HTMLElement>('#barcelona-page-layout')].find(
      (element) => element.checkVisibility(),
    );
    if (!page || page === this.preparedPage) return;
    const dispatcher = findDispatcher(page);
    if (!dispatcher?.preloadRouteCode) return;
    // Fetch native column code through the same route preloader as link hover. Never navigate.
    try {
      dispatcher.preloadRouteCode('/');
      this.preparedPage = page;
    } catch {
      /* Leave clicks native if the site's preload capability changed. */
    }
  }

  reconcile(): void {
    if (
      this.host &&
      (!this.host.isConnected ||
        location.href !== this.route ||
        !this.page?.isConnected ||
        !this.page.checkVisibility() ||
        !this.source?.isConnected)
    )
      this.close();
  }

  open(source: HTMLElement, url: string): boolean {
    if (
      !supportsStandalone(new URL(location.href)) ||
      window.innerWidth < this.navigationInset() + WIDTH * 2 + GAP
    )
      return false;
    const page = source.closest<HTMLElement>('#barcelona-page-layout');
    if (!page?.checkVisibility() || source.closest('[data-deck-column]')) return false;
    const react = load('react') as typeof React | null;
    const dom = load('ReactDOM') as NativeDOM | null;
    const Column = load('BarcelonaRoutedColumn.react') as React.ComponentType<
      Record<string, unknown>
    > | null;
    if (
      !react?.createElement ||
      !react.Component ||
      !dom?.createRoot ||
      !dom.flushSync ||
      typeof Column !== 'function'
    )
      return false;
    const contexts = nativeContexts(page);
    // Rendering a spinner is not sufficient: require the live route store and dispatcher first.
    for (const name of [
      'CometRouteStoreContext',
      'CometRouterUIComponentContext',
      'CometRouterDispatcherContext',
    ]) {
      const context = load(name);
      if (!context || !contexts.get(context)) return false;
    }
    try {
      if (this.page !== page) this.close();
      this.page = page;
      this.source = source;
      this.route = location.href;
      if (!this.host) {
        this.host = document.createElement('aside');
        this.host.setAttribute('data-sideview-threads-panel', '');
        this.host.style.cssText = `position:fixed;top:0;width:${WIDTH}px;height:100dvh;overflow:auto;`;
        this.style = document.createElement('style');
        document.head.append(this.style);
        page.setAttribute(SOURCE, '');
        // Keep the panel below Threads' root-level menu/dialog portals in the stacking order.
        page.append(this.host);
        this.root = dom.createRoot(this.host);
        window.addEventListener('resize', this.resize);
        window.addEventListener('popstate', this.reconcileRoute);
      }
      if (!this.position()) {
        this.close();
        return false;
      }
      const close = () => this.close();
      class Boundary extends react.Component<{ children: React.ReactNode }, { failed: boolean }> {
        override state = { failed: false };
        static getDerivedStateFromError() {
          return { failed: true };
        }
        override render() {
          return this.state.failed
            ? react?.createElement(
                'div',
                null,
                react.createElement('a', { href: url }, 'Open in Threads'),
                react.createElement('button', { onClick: close }, 'Close'),
              )
            : this.props.children;
        }
      }
      let tree: React.ReactElement = react.createElement(Column, {
        key: url,
        initialURL: url,
        index: 1,
        performsInColumnNavigation: true,
        isActiveColumnForKeyCommands: false,
        isPersistentHomeColumn: false,
        onUnpin: close,
      });
      for (const [context, value] of contexts)
        tree = react.createElement((context as React.Context<unknown>).Provider, { value }, tree);
      dom.flushSync(() => this.root?.render(react.createElement(Boundary, { children: tree })));
      if (this.host.checkVisibility()) return true;
      this.close();
      return false;
    } catch {
      this.close();
      return false;
    }
  }

  close(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('popstate', this.reconcileRoute);
    const root = this.root;
    this.root = null;
    // Unmounting may trigger native effect cleanup. Always restore layout, even if it throws.
    try {
      root?.unmount();
    } finally {
      this.host?.remove();
      this.host = null;
      this.page?.removeAttribute(SOURCE);
      this.page = null;
      this.source = null;
      this.style?.remove();
      this.style = null;
    }
  }

  private position(): boolean {
    if (!this.host || !this.source || !this.style) return false;
    const inset = this.navigationInset();
    if (window.innerWidth < inset + WIDTH * 2 + GAP) return false;
    this.style.textContent = `#barcelona-page-layout[${SOURCE}] {padding-inline-start:${inset}px!important;padding-inline-end:${WIDTH + GAP}px!important;box-sizing:border-box!important}`;
    const rect = this.source.getBoundingClientRect();
    const left = rect.right + GAP;
    if (rect.width <= 0 || rect.left < inset || left + WIDTH > window.innerWidth) return false;
    this.host.style.left = `${left}px`;
    return true;
  }
  private navigationInset(): number {
    let right = 0;
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      'a[href="/"],a[href="/activity"],a[href="/search"]',
    )) {
      if (link.closest('#barcelona-page-layout') || !link.checkVisibility()) continue;
      right = Math.max(right, link.getBoundingClientRect().right);
    }
    return right + GAP;
  }
  private readonly resize = () => {
    if (!this.position()) this.close();
  };
  private readonly reconcileRoute = () => this.reconcile();
}
