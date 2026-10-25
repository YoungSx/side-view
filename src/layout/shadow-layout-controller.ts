import { i18n } from '#i18n';
import type { ContentScriptContext, ShadowRootContentScriptUi } from '#imports';
import { createShadowRootUi } from '#imports';
import { log } from '@/core/log';
import {
  SV_ACTIVE_CLASS,
  SV_HOST_ATTR,
  SV_LAYOUT_STYLE_ID,
  SV_MIN_VIEWPORT_PX,
  SV_MODE_CLASS,
} from '@/core/style-ids';
import type { LayoutController, LayoutMode, LayoutMountHooks, PlatformAdapter } from '@/core/types';
import {
  clampColumnWidth,
  resizeColumnWidth,
  SV_WIDTH_MAX_PX,
  SV_WIDTH_MIN_PX,
} from '@/core/width';
import { COMPACT_REQUEST, NAVIGATION_CHANGE } from '@/platforms/compact/protocol';

/**
 * Places the detail column in the host page using WXT's shadow-root UI.
 *
 * Style isolation comes from the shadow root (`all: initial` reset); the host is anchored as the
 * sibling after the platform's timeline column and an observer reattaches it whenever the host
 * page rebuilds that column on SPA navigation. The reversible layout tweaks (hide native sidebar,
 * preserve the timeline width) live in a `<style>` in `<head>`, which host re-renders never touch.
 */
export class ShadowLayoutController implements LayoutController {
  private ui: ShadowRootContentScriptUi<HTMLElement> | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private hooks: LayoutMountHooks | null = null;
  private observer: MutationObserver | null = null;
  private state: 'uninitialized' | 'initializing' | 'closed' | 'open' | 'disposed' =
    'uninitialized';
  private mode: LayoutMode = 'replace-sidebar';
  /** The host page's sampled surface (background + text), applied so the column blends in. */
  private surface: { background: string; foreground: string } = { background: '', foreground: '' };
  private themeQuery: MediaQueryList | null = null;
  private stopObservingAvailability: (() => void) | null = null;
  /** The column-edge drag handle, resident in the shadow root while the host exists. */
  private handle: HTMLElement | null = null;
  private drag: { startX: number; startWidth: number } | null = null;
  private onWidthCommit: ((px: number) => void) | null = null;

  constructor(
    private readonly ctx: ContentScriptContext,
    private readonly adapter: PlatformAdapter,
    private width: number,
  ) {}

  async initialize(mode: LayoutMode, hooks: LayoutMountHooks): Promise<void> {
    if (this.state !== 'uninitialized') throw new Error('Layout already initialized');
    this.mode = mode;
    this.hooks = hooks;
    this.state = 'initializing';
    // Prepare a detached UI. Only open() may insert it or change the page layout.
    this.ctx.onInvalidated(() => this.detach());

    try {
      const { selector, append } = this.adapter.columnAnchor;
      const ui = await createShadowRootUi<HTMLElement>(this.ctx, {
        name: 'side-view-column',
        position: 'inline',
        // Use our reset: WXT's `all: initial !important` overrides the host's flex sizing.
        inheritStyles: true,
        anchor: selector,
        append,
        isolateEvents: true,
        onMount: (container, _shadow, host) => {
          host.setAttribute(SV_HOST_ATTR, '');
          this.styleHost(host);
          this.hooks?.onMount(container);
          return container;
        },
        onRemove: () => this.hooks?.onRemove(),
      });
      if (this.ctx.isInvalid) {
        ui.remove();
        return;
      }
      this.ui = ui;
      // A drag handle on the column's left edge lives in the shadow root, above the iframe.
      // Opt-in per platform (`resizable`): other sites keep a full-bleed frame for now.
      if (this.adapter.resizable) {
        this.handle = this.createResizeHandle();
        ui.shadow.append(this.handle);
      }
      // X can replace its children without changing the URL or ever leaving the anchor absent.
      // Observe the actual host connection as well as the current anchor, not just selector existence.
      this.observer = new MutationObserver(() => this.reattachIfDetached());
      this.state = 'closed';
      this.stopObservingAvailability =
        this.adapter.observeLayoutAvailability?.(() => this.close()) ?? null;
      window.addEventListener('resize', this.resizeColumn);
      window.addEventListener(NAVIGATION_CHANGE, this.resizeColumn);
      // Re-sample the surface when the OS colour scheme flips so a live theme change re-tints.
      this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.themeQuery.addEventListener?.('change', this.onThemeChange);
    } catch (error) {
      this.detach(); // roll back the layout mutations so X's own layout is restored
      throw error;
    }
  }

  /** Whether the column is currently shown; below the min viewport it is hidden by CSS. */
  isColumnVisible(): boolean {
    const host = this.ui?.shadowHost;
    return (
      !!host?.isConnected &&
      host.getBoundingClientRect().width > 0 &&
      window.matchMedia(`(min-width: ${SV_MIN_VIEWPORT_PX}px)`).matches
    );
  }

  /** Restore the native page until the next eligible tweet click. */
  close(): void {
    if (this.state === 'open') this.state = 'closed';
    this.observer?.disconnect();
    this.ui?.remove();
    this.styleEl?.remove();
    this.styleEl = null;
    this.adapter.applyGridReservation?.(null);
    this.removeBodyClasses();
  }

  /** Mount synchronously after content is prepared, so a failed open can fall through natively. */
  open(): boolean {
    if (this.state !== 'closed' && this.state !== 'open') return false;
    const anchor = this.adapter.getPrimaryColumn();
    if (
      !anchor?.parentElement ||
      !window.matchMedia(`(min-width: ${SV_MIN_VIEWPORT_PX}px)`).matches ||
      !this.bounds()
    )
      return false;
    try {
      this.state = 'open';
      this.sampleSurface();
      this.injectLayoutCss();
      this.reattachIfDetached();
      if (!this.isColumnVisible()) {
        this.close();
        return false;
      }
      this.observer?.observe(document.body, { childList: true, subtree: true });
      return true;
    } catch (error) {
      this.close();
      log.error('failed to open detail column', error);
      return false;
    }
  }

  setMode(mode: LayoutMode): void {
    if (mode === this.mode) return;
    document.body.classList.remove(SV_MODE_CLASS[this.mode]);
    this.mode = mode;
    if (this.state === 'open') {
      if (this.ui?.shadowHost.isConnected) document.body.classList.add(SV_MODE_CLASS[mode]);
      this.injectLayoutCss();
      this.resizeColumn();
    }
  }

  setWidth(px: number): void {
    this.width = px;
    if (this.state === 'open') this.injectLayoutCss();
    if (this.ui) this.styleHost(this.ui.shadowHost);
    this.handle?.setAttribute('aria-valuenow', String(px));
  }

  /**
   * Receive the width a drag/keyboard resize settled on. The engine routes this into settings
   * storage; the live `columnWidth` watcher re-applies it, which is a no-op for equal values.
   */
  setOnWidthCommit(commit: (px: number) => void): void {
    this.onWidthCommit = commit;
  }

  /** The column edge: drag left to widen, exactly like the native os window it imitates. */
  private createResizeHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'sv-resize-handle';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', i18n.t('detail.resizeColumn'));
    handle.setAttribute('aria-valuemin', String(SV_WIDTH_MIN_PX));
    handle.setAttribute('aria-valuemax', String(SV_WIDTH_MAX_PX));
    handle.setAttribute('aria-valuenow', String(this.width));
    handle.tabIndex = 0;
    handle.addEventListener('pointerdown', this.onResizeStart);
    handle.addEventListener('pointermove', this.onResizeMove);
    handle.addEventListener('pointerup', this.onResizeEnd);
    handle.addEventListener('pointercancel', this.onResizeEnd);
    handle.addEventListener('keydown', this.onResizeKey);
    return handle;
  }

  private readonly onResizeStart = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const host = this.ui?.shadowHost;
    const startWidth = host?.getBoundingClientRect().width ?? 0;
    if (!host || startWidth <= 0) return;
    this.drag = { startX: event.clientX, startWidth };
    this.handle?.setAttribute('data-dragging', '');
    // Keep the drag alive while the pointer crosses the iframe; absent under jsdom.
    try {
      this.handle?.setPointerCapture(event.pointerId);
    } catch {
      // Environments without pointer capture still drag inside the shadow root.
    }
    event.preventDefault();
  };

  private readonly onResizeMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    this.setWidth(resizeColumnWidth(this.drag.startWidth, this.drag.startX, event.clientX));
  };

  private readonly onResizeEnd = (): void => {
    if (!this.drag) return;
    this.drag = null;
    this.handle?.removeAttribute('data-dragging');
    this.commitWidth();
  };

  private readonly onResizeKey = (event: KeyboardEvent): void => {
    // The edge follows the arrow: ArrowLeft pushes it left (wider), ArrowRight narrows.
    const step = event.shiftKey ? 50 : 10;
    const delta = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
    if (delta === 0) return;
    event.preventDefault();
    this.setWidth(clampColumnWidth(this.width + delta));
    this.commitWidth();
  };

  /** Persist what the user actually sees: the laid-out width after the geometry clamp. */
  private commitWidth(): void {
    const width = this.bounds()?.width ?? 0;
    if (width > 0) this.onWidthCommit?.(Math.round(width));
  }

  setCompactNavigation(enabled: boolean): void {
    if (this.state === 'disposed') return;
    document.documentElement.setAttribute(COMPACT_REQUEST, String(enabled));
    this.resizeColumn();
  }

  reattachIfDetached(): void {
    const ui = this.ui;
    if (this.state !== 'open' || !ui) return;
    const { selector, append } = this.adapter.columnAnchor;
    const anchor = document.querySelector(selector);
    if (!anchor?.parentElement) {
      if (ui.mounted || ui.shadowHost.isConnected) ui.remove();
      this.removeBodyClasses();
      return;
    }
    const adjacent = append === 'after' ? anchor.nextElementSibling : anchor.previousElementSibling;
    if (adjacent !== ui.shadowHost) {
      // Reuse the existing React tree when X only detached/moved the host.
      if (ui.mounted) {
        if (append === 'after') anchor.after(ui.shadowHost);
        else anchor.before(ui.shadowHost);
      } else {
        ui.mount();
      }
    }
    document.body.classList.add(SV_ACTIVE_CLASS, SV_MODE_CLASS[this.mode]);
    this.styleHost(ui.shadowHost);
  }

  detach(): void {
    this.state = 'disposed';
    this.stopObservingAvailability?.();
    this.stopObservingAvailability = null;
    this.observer?.disconnect();
    this.observer = null;
    this.handle = null;
    this.drag = null;
    this.onWidthCommit = null;
    window.removeEventListener('resize', this.resizeColumn);
    window.removeEventListener(NAVIGATION_CHANGE, this.resizeColumn);
    this.themeQuery?.removeEventListener?.('change', this.onThemeChange);
    this.themeQuery = null;
    this.ui?.remove();
    this.ui = null;
    this.styleEl?.remove();
    this.styleEl = null;
    this.adapter.applyGridReservation?.(null);
    this.removeBodyClasses();
    document.documentElement.removeAttribute(COMPACT_REQUEST);
  }

  private removeBodyClasses(): void {
    document.body.classList.remove(
      SV_ACTIVE_CLASS,
      SV_MODE_CLASS['replace-sidebar'],
      SV_MODE_CLASS['insert-column'],
    );
  }

  private injectLayoutCss(): void {
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = SV_LAYOUT_STYLE_ID;
      document.head.appendChild(this.styleEl);
    }
    const reservation =
      this.adapter.columnPosition === 'split'
        ? `body.${SV_ACTIVE_CLASS} { --sv-column-width: min(${this.width}px, 50vw); }`
        : '';
    this.styleEl.textContent = `${reservation}\n${this.adapter.layoutCss(this.mode)}`;
    // Themes whose cascade beats stylesheets get an inline reservation instead; it references
    // the same variable, so drags re-resolve it without rewriting the template.
    this.adapter.applyGridReservation?.(reservation ? 'var(--sv-column-width, 0px)' : null);
  }

  private styleHost(host: HTMLElement): void {
    // Match the host page's own surface so the column and its loading state never flash a
    // hardcoded colour that clashes with the live theme. Custom properties survive the shadow
    // root's `all: initial` reset and inherit inward to the column CSS.
    if (this.surface.background) host.style.setProperty('--sv-surface', this.surface.background);
    if (this.surface.foreground) host.style.setProperty('--sv-on-surface', this.surface.foreground);
    // The frame gutter that clears the resize strip is gated on the same opt-in as the handle.
    host.toggleAttribute('data-sv-resizable', !!this.adapter.resizable);

    const bounds = this.bounds();
    // A null measurement means the timeline column is momentarily gone (an SPA rebuild). Keep the
    // last good geometry rather than collapsing a fixed column onto the far-left edge (left: 0).
    if (!bounds) return;

    host.style.flex = `0 0 ${bounds.width}px`;
    host.style.width = `${bounds.width}px`;
    host.style.overflow = 'hidden';
    host.style.alignSelf = 'flex-start';
    const fixed = this.adapter.columnPosition !== 'inline';
    host.style.position = fixed ? 'fixed' : 'sticky';
    if (fixed) {
      host.style.left = `${bounds.left}px`;
      host.style.zIndex = '10';
    }
    // Sites with a persistent global header hand the strip above the column to it: the column
    // starts below the header, whose dropdown panels then paint over the column (z 1000 > 10).
    const top = this.adapter.columnTop?.() ?? 0;
    host.style.top = `${top}px`;
    host.style.height = `calc(100vh - ${top}px)`;
    host.style.minWidth = '0';
  }

  /** Sample the host page's background + text colour for the immersive column surface. */
  private sampleSurface(): void {
    const view = document.defaultView;
    if (!view) return;
    const opaque = (color: string): boolean =>
      color !== '' &&
      color !== 'transparent' &&
      // Only rgba's fourth channel is alpha; rgb(0, 0, 0) is opaque black.
      !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color);
    let background = '';
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const color = view.getComputedStyle(el).backgroundColor;
      if (opaque(color)) {
        background = color;
        break;
      }
    }
    const foreground = document.body ? view.getComputedStyle(document.body).color : '';
    this.surface = { background, foreground };
  }

  private readonly onThemeChange = (): void => {
    this.sampleSurface();
    this.resizeColumn();
  };

  /**
   * Left edge for the detail column: the timeline column's right edge (and, when a native sidebar
   * is retained in insert-column mode, past that). Returns null when the timeline column can't be
   * measured right now, so a fixed column is never pinned to the far-left corner on a transient miss.
   */
  private columnLeft(): number | null {
    const rect = this.adapter.getPrimaryColumn()?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.right <= 0) return null;
    let left = rect.right;
    if (this.adapter.columnPosition === 'fixed' && this.mode === 'insert-column') {
      const sidebar = this.adapter.getSidebarColumn()?.getBoundingClientRect();
      if (sidebar && sidebar.right > left) left = sidebar.right;
    }
    return left;
  }

  private bounds(): { left: number; width: number } | null {
    if (this.adapter.columnPosition === 'split') {
      const primary = this.adapter.getPrimaryColumn()?.getBoundingClientRect();
      if (!primary || primary.width <= 0) return null;
      const viewport = document.documentElement.clientWidth;
      const width = Math.min(this.width, viewport / 2);
      if (width <= 0) return null;
      // A capped/centered wrapper never reaches the viewport edge: dock to the wrapper.
      const edge = this.adapter.columnRight?.();
      const right = typeof edge === 'number' && edge > 0 ? edge : viewport;
      return { left: Math.max(0, right - width), width };
    }
    const left = this.columnLeft();
    if (left === null) return null;
    const width = Math.min(this.width, Math.max(0, document.documentElement.clientWidth - left));
    return width > 0 ? { left, width } : null;
  }

  private readonly resizeColumn = (): void => {
    if (!this.ui?.shadowHost.isConnected) return;
    this.styleHost(this.ui.shadowHost);
  };
}
