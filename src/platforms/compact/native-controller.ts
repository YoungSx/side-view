import { findBlueskyNavigation, findXNavigation, type NativeNavigation } from './native-runtime';
import { COMPACT_REQUEST, COMPACT_STATUS, NAVIGATION_CHANGE } from './protocol';

export function installNativeNavigation(
  resolve: () => NativeNavigation | null = () =>
    location.hostname === 'bsky.app' ? findBlueskyNavigation(document) : findXNavigation(document),
): () => void {
  const root = document.documentElement;
  let current: NativeNavigation | null = null;
  let acquired = false;
  let frame: number | null = null;
  let disposed = false;
  let failedIdentity: unknown;
  const release = () => {
    if (!acquired) return;
    acquired = false;
    current?.set(false);
  };
  const reconcile = () => {
    frame = null;
    if (disposed) return;
    try {
      const next = resolve();
      if (current?.identity !== next?.identity || current?.element !== next?.element) {
        release();
        current = next;
      }
      const available = !!current && current.identity !== failedIdentity;
      const enabled = available && root.getAttribute(COMPACT_REQUEST) === 'true';
      if (enabled && !acquired) {
        acquired = true;
        current?.set(true);
      } else if (!enabled) release();
      else current?.refresh();
      const status = available ? (enabled ? 'active' : 'available') : 'unavailable';
      if (root.getAttribute(COMPACT_STATUS) !== status) root.setAttribute(COMPACT_STATUS, status);
      window.dispatchEvent(new Event(NAVIGATION_CHANGE));
    } catch {
      failedIdentity = current?.identity;
      try {
        release();
      } catch {
        /* Site capability disappeared; never fall back to CSS. */
      }
      root.setAttribute(COMPACT_STATUS, 'unavailable');
    }
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = window.requestAnimationFrame(reconcile);
  };
  const config = new MutationObserver(schedule);
  config.observe(root, { attributes: true, attributeFilter: [COMPACT_REQUEST] });
  const tree = new MutationObserver((records) => {
    if (!current?.element.isConnected || records.some((r) => current?.element.contains(r.target)))
      schedule();
  });
  tree.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('sv:locationchange', schedule);
  window.addEventListener('popstate', schedule);
  reconcile();
  return () => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    config.disconnect();
    tree.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('sv:locationchange', schedule);
    window.removeEventListener('popstate', schedule);
    try {
      release();
    } finally {
      root.removeAttribute(COMPACT_STATUS);
    }
  };
}
