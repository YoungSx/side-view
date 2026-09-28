import type { ContentScriptContext } from '#imports';

export type RouteHandler = (url: URL) => void;

/**
 * Observe SPA route changes. Two redundant signals feed one rAF-debounced handler:
 *  1. The Navigation API `navigate` event — the isolated world still sees the shared document's
 *     navigations, so no MAIN-world access is needed where it's supported.
 *  2. A `sv:locationchange` event dispatched by the MAIN-world history bridge
 *     (`x-history-bridge`), covering engines where (1) is unavailable or silent for programmatic
 *     `pushState`. `popstate` is added for back/forward.
 * De-duplicated by URL so the belt-and-suspenders signals never double-fire for one navigation.
 * Debounced via rAF because the route event fires before the host rebuilds the new subtree.
 */
export function observeRoute(ctx: ContentScriptContext, onChange: RouteHandler): void {
  let last = location.href;
  let scheduled = false;

  const emit = (): void => {
    const href = location.href;
    if (href === last) return;
    last = href;
    onChange(new URL(href));
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      emit();
    });
  };

  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  nav?.addEventListener('navigate', schedule);
  window.addEventListener('sv:locationchange', schedule);
  window.addEventListener('popstate', schedule);

  ctx.onInvalidated(() => {
    nav?.removeEventListener('navigate', schedule);
    window.removeEventListener('sv:locationchange', schedule);
    window.removeEventListener('popstate', schedule);
  });
}
