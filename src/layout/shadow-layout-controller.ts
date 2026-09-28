import type { ContentScriptContext, ShadowRootContentScriptUi } from '#imports';
import { createShadowRootUi } from '#imports';
import {
  SV_ACTIVE_CLASS,
  SV_HOST_ATTR,
  SV_LAYOUT_STYLE_ID,
  SV_MIN_VIEWPORT_PX,
  SV_MODE_CLASS,
} from '@/core/style-ids';
import type { LayoutController, LayoutMode, LayoutMountHooks, PlatformAdapter } from '@/core/types';

/**
 * Places the detail column in the host page using WXT's shadow-root UI.
 *
 * Style isolation comes from the shadow root (`all: initial` reset); the host is anchored as the
 * sibling after the platform's timeline column and `autoMount()` re-mounts it whenever the host
 * page rebuilds that column on SPA navigation. The reversible layout tweaks (hide native sidebar,
 * widen the timeline) live in a `<style>` in `<head>`, which host re-renders never touch.
 */
export class ShadowLayoutController implements LayoutController {
  private ui: ShadowRootContentScriptUi<HTMLElement> | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private hooks: LayoutMountHooks | null = null;
  private mode: LayoutMode = 'replace-sidebar';

  constructor(
    private readonly ctx: ContentScriptContext,
    private readonly adapter: PlatformAdapter,
    private width: number,
  ) {}

  async attach(mode: LayoutMode, hooks: LayoutMountHooks): Promise<void> {
    this.mode = mode;
    this.hooks = hooks;
    this.injectLayoutCss();
    document.body.classList.add(SV_ACTIVE_CLASS, SV_MODE_CLASS[mode]);
    // Body classes gate the layout CSS (hide native sidebar, widen timeline) the instant they are
    // added; ensure they are removed even if the async mount below throws or the context dies, so
    // the host page is never left mangled with no column mounted.
    this.ctx.onInvalidated(() => this.removeBodyClasses());

    try {
      const { selector, append } = this.adapter.columnAnchor;
      this.ui = await createShadowRootUi<HTMLElement>(this.ctx, {
        name: 'side-view-column',
        position: 'inline',
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
      this.ui.autoMount();
    } catch (error) {
      this.detach(); // roll back the layout mutations so X's own layout is restored
      throw error;
    }
  }

  /** Whether the column is currently shown; below the min viewport it is hidden by CSS. */
  isColumnVisible(): boolean {
    return window.matchMedia(`(min-width: ${SV_MIN_VIEWPORT_PX}px)`).matches;
  }

  setMode(mode: LayoutMode): void {
    if (mode === this.mode) return;
    document.body.classList.remove(SV_MODE_CLASS[this.mode]);
    this.mode = mode;
    document.body.classList.add(SV_MODE_CLASS[mode]);
    this.injectLayoutCss();
  }

  setWidth(px: number): void {
    this.width = px;
    if (this.ui) this.styleHost(this.ui.shadowHost);
  }

  reattachIfDetached(): void {
    if (!this.ui || this.ui.shadowHost.isConnected) return;
    try {
      this.ui.mount();
    } catch {
      // The route event fires before the host page rebuilds the timeline column, so the anchor
      // selector can be momentarily absent and WXT's mount() throws "could not find anchor element".
      // That's benign here: autoMount re-mounts once the anchor reappears. Swallow it so this
      // secondary guard never surfaces an uncaught error on every navigation.
    }
  }

  detach(): void {
    this.ui?.remove();
    this.ui = null;
    this.styleEl?.remove();
    this.styleEl = null;
    this.removeBodyClasses();
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
      this.ctx.onInvalidated(() => this.styleEl?.remove());
    }
    this.styleEl.textContent = this.adapter.layoutCss(this.mode);
  }

  private styleHost(host: HTMLElement): void {
    host.style.flex = `0 0 ${this.width}px`;
    host.style.alignSelf = 'stretch';
    host.style.minWidth = '0';
  }
}
