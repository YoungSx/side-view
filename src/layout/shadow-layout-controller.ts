import type { ContentScriptContext, ShadowRootContentScriptUi } from '#imports';
import { createShadowRootUi } from '#imports';
import { log } from '@/core/log';
import {
  SV_ACTIVE_CLASS,
  SV_COMPACT_NAV_CLASS,
  SV_HOST_ATTR,
  SV_LAYOUT_STYLE_ID,
  SV_MIN_VIEWPORT_PX,
  SV_MODE_CLASS,
  SV_NAV_STYLE_ID,
} from '@/core/style-ids';
import type { LayoutController, LayoutMode, LayoutMountHooks, PlatformAdapter } from '@/core/types';

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
  private navigationStyleEl: HTMLStyleElement | null = null;
  private hooks: LayoutMountHooks | null = null;
  private observer: MutationObserver | null = null;
  private state: 'uninitialized' | 'initializing' | 'closed' | 'open' | 'disposed' =
    'uninitialized';
  private mode: LayoutMode = 'replace-sidebar';

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
      // X can replace its children without changing the URL or ever leaving the anchor absent.
      // Observe the actual host connection as well as the current anchor, not just selector existence.
      this.observer = new MutationObserver(() => this.reattachIfDetached());
      this.state = 'closed';
      window.addEventListener('resize', this.resizeColumn);
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
    if (this.ui) this.styleHost(this.ui.shadowHost);
  }

  setCompactNavigation(enabled: boolean): void {
    if (this.state === 'disposed') return;
    this.navigationStyleEl?.remove();
    this.navigationStyleEl = null;
    document.body.classList.toggle(SV_COMPACT_NAV_CLASS, enabled);
    if (enabled) {
      this.navigationStyleEl = document.createElement('style');
      this.navigationStyleEl.id = SV_NAV_STYLE_ID;
      this.navigationStyleEl.textContent = this.adapter.compactNavigationCss();
      document.head.append(this.navigationStyleEl);
    }
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
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener('resize', this.resizeColumn);
    this.ui?.remove();
    this.ui = null;
    this.styleEl?.remove();
    this.styleEl = null;
    this.removeBodyClasses();
    this.navigationStyleEl?.remove();
    this.navigationStyleEl = null;
    document.body.classList.remove(SV_COMPACT_NAV_CLASS);
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
    this.styleEl.textContent = this.adapter.layoutCss(this.mode);
  }

  private styleHost(host: HTMLElement): void {
    const bounds = this.bounds();
    const right = bounds?.left ?? 0;
    const available = bounds?.width ?? 0;
    host.style.flex = `0 0 ${Math.min(this.width, available)}px`;
    host.style.width = `${Math.min(this.width, available)}px`;
    host.style.overflow = 'hidden';
    host.style.alignSelf = 'flex-start';
    const fixed = this.adapter.columnPosition === 'fixed';
    host.style.position = fixed ? 'fixed' : 'sticky';
    if (fixed) {
      host.style.left = `${right}px`;
      host.style.zIndex = '10';
    }
    host.style.top = '0';
    host.style.height = '100vh';
    host.style.minWidth = '0';
  }

  private columnLeft(): number {
    const primaryRight = this.adapter.getPrimaryColumn()?.getBoundingClientRect().right ?? 0;
    if (this.adapter.columnPosition === 'fixed' && this.mode === 'insert-column') {
      const sidebar = this.adapter.getSidebarColumn();
      if (sidebar) return Math.max(primaryRight, sidebar.getBoundingClientRect().right);
    }
    return primaryRight;
  }

  private bounds(): { left: number; width: number } | null {
    const left = this.columnLeft();
    const width = Math.min(this.width, Math.max(0, document.documentElement.clientWidth - left));
    return width > 0 ? { left, width } : null;
  }

  private readonly resizeColumn = (): void => {
    if (!this.ui?.shadowHost.isConnected) return;
    this.styleHost(this.ui.shadowHost);
  };
}
