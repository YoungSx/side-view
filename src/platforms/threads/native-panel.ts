import type * as React from 'react';
import {
  columnAnchor,
  hostBoxCss,
  insertColumn,
  measureColumnBox,
  PANEL_ATTR,
} from './native-column-box';
import { findDispatcher, nativeContexts } from './native-runtime';

/** Routes that render exactly one column we may sit beside.
 *
 * REPLICATION, not reuse: this list only decides *where* the replica may be hosted.
 * Which URLs are worth hijacking is a separate question, answered by
 * `resolveThreadsUrl` in `./url.ts`.
 */
export function supportsStandalone(url: URL): boolean {
  return (
    url.pathname === '/' ||
    /^\/(?:activity|following|saved|liked|for_you|archive)\/?$/.test(url.pathname) ||
    /^\/custom_feed\/[^/]+\/?$/.test(url.pathname) ||
    // Profiles, and both the search results and the empty search page's
    // recommended-user list, which is just as much a timeline to click through.
    /^\/@[A-Za-z0-9._]+\/?$/.test(url.pathname) ||
    url.pathname.replace(/\/$/, '') === '/search'
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

/** Ephemeral replica column for routes where Threads mounts no column of its own.
 *
 * REUSE: the column body is Threads' own `BarcelonaRoutedColumn.react`, mounted with
 * Threads' own React and its live router contexts — see `native-runtime.ts`.
 * REPLICATION: only the outer box, derived from live measurements in
 * `native-column-box.ts`. Nothing is pinned or saved to the account.
 */
export class ThreadsNativePanel {
  private root: NativeRoot | null = null;
  private host: HTMLElement | null = null;
  private page: HTMLElement | null = null;
  private source: HTMLElement | null = null;
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
    if (!supportsStandalone(new URL(location.href))) return false;
    const page = columnAnchor(source);
    if (!page) return false;
    // REPLICATION: derive the box before mounting, so a host is never created that we
    // cannot size. Nothing measurable means nothing to match — leave the click native.
    const box = measureColumnBox(source);
    if (!box) return false;
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
        // REPLICATION: a plain host carrying only a measured box. It joins Threads' own
        // flex row, so the site's layout owns width, spacing and stacking — there is no
        // second scroller and no padding write against `#barcelona-page-layout`.
        this.host = document.createElement('div');
        this.host.setAttribute(PANEL_ATTR, '');
        insertColumn(this.host, page);
        this.root = dom.createRoot(this.host);
        window.addEventListener('resize', this.resize);
        window.addEventListener('popstate', this.reconcileRoute);
      }
      this.host.style.cssText = hostBoxCss(box);
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
      if (this.host.checkVisibility() && this.fitsViewport()) return true;
      this.close();
      return false;
    } catch {
      this.close();
      return false;
    }
  }

  /** Threads clips its page row rather than scrolling it, so an over-wide replica would be
   * silently cut off. Measure after mounting instead of predicting it from viewport maths. */
  private fitsViewport(): boolean {
    const rect = this.host?.getBoundingClientRect();
    return !!rect && rect.width > 0 && rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5;
  }

  close(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('popstate', this.reconcileRoute);
    const root = this.root;
    this.root = null;
    // Unmounting may trigger native effect cleanup. Always detach the host, even if it throws.
    try {
      root?.unmount();
    } finally {
      this.host?.remove();
      this.host = null;
      this.page = null;
      this.source = null;
    }
  }

  /** Threads' column width is responsive, so re-measure rather than re-use the old box. */
  private readonly resize = () => {
    const box = this.source && measureColumnBox(this.source);
    if (!box || !this.host) {
      this.close();
      return;
    }
    this.host.style.cssText = hostBoxCss(box);
    if (!this.fitsViewport()) this.close();
  };
  private readonly reconcileRoute = () => this.reconcile();
}
