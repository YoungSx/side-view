import { SV_ACTIVE_CLASS, SV_MIN_VIEWPORT_PX } from '@/core/style-ids';
import { XHS_LAYOUT_STATUS } from './protocol';

/** Narrow compatibility boundary for the site's reactive layout, not its feed or account data. */
export interface FeedLayoutStore {
  columns: number;
  columnWidth: number;
  gap: { horizontal: number };
  $patch(value: { columns: number; columnWidth: number }): void;
  $subscribe(callback: () => void, options: { detached: boolean }): () => void;
  resize(): void;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function findFeedLayout(doc: Document): FeedLayoutStore | null {
  const app = record(record(doc.querySelector('#app'))?.__vue_app__);
  const globals = record(record(app?.config)?.globalProperties);
  const stores = record(globals?.$pinia)?._s;
  if (!(stores instanceof Map)) return null;
  const store = record(stores.get('layout'));
  const gap = record(store?.gap);
  if (
    !store ||
    !gap ||
    !Number.isInteger(store.columns) ||
    Number(store.columns) < 1 ||
    Number(store.columns) > 20 ||
    typeof store.columnWidth !== 'number' ||
    !Number.isFinite(store.columnWidth) ||
    store.columnWidth <= 0 ||
    typeof gap.horizontal !== 'number' ||
    !Number.isFinite(gap.horizontal) ||
    gap.horizontal < 0 ||
    gap.horizontal > 128 ||
    typeof store.$patch !== 'function' ||
    typeof store.$subscribe !== 'function' ||
    typeof store.resize !== 'function'
  )
    return null;
  return store as unknown as FeedLayoutStore;
}

/** Retain native columns when they fit, reducing their count only at the site's 142px minimum. */
export function fitFeedColumns(width: number, columns: number, gap: number) {
  const count = Math.max(1, Math.min(columns, Math.floor((width + gap) / (142 + gap))));
  return { columns: count, columnWidth: Math.max(0, (width - (count - 1) * gap) / count) };
}

/**
 * Runs in MAIN. Updating the validated Pinia fields activates Xiaohongshu's own
 * useFeedsRelayoutController: it recalculates every position, virtualization and scroll anchor.
 * Its resize() alone reads window.innerWidth, so cannot account for a reserved side column.
 */
export function installFeedLayout(
  resolve: () => FeedLayoutStore | null = () => findFeedLayout(document),
): () => void {
  let current: FeedLayoutStore | null = null;
  let unsubscribe: (() => void) | null = null;
  let owned: { columns: number; columnWidth: number; nativeColumns: number } | null = null;
  let frame: number | null = null;
  let disposed = false;
  let failed: FeedLayoutStore | null = null;
  const root = document.documentElement;
  const release = () => {
    if (!owned) return;
    owned = null;
    current?.resize(); // Restore today's native viewport layout, including resizes while open.
  };
  const reconcile = () => {
    frame = null;
    if (disposed) return;
    try {
      const next = resolve();
      if (next !== current) {
        unsubscribe?.();
        unsubscribe = null;
        release();
        current = next;
        if (current) unsubscribe = current.$subscribe(schedule, { detached: true });
      }
      const available = !!current && current !== failed;
      const status = available ? 'available' : 'unavailable';
      if (root.getAttribute(XHS_LAYOUT_STATUS) !== status)
        root.setAttribute(XHS_LAYOUT_STATUS, status);
      const feed = [...document.querySelectorAll<HTMLElement>('.feeds-container')].find(
        (el) => el.checkVisibility?.() !== false && el.querySelector('section.note-item'),
      );
      if (
        !available ||
        !current ||
        !feed ||
        !document.body.classList.contains(SV_ACTIVE_CLASS) ||
        window.innerWidth < SV_MIN_VIEWPORT_PX
      ) {
        release();
        return;
      }
      const rect = feed.getBoundingClientRect();
      const app = document.querySelector('#app')?.getBoundingClientRect();
      const width = Math.min(rect.width, (app?.right ?? rect.right) - rect.left);
      if (width <= 0) return;
      // An outside/native resize can change the store between reconciliations.
      const unchanged =
        owned &&
        current.columns === owned.columns &&
        Math.abs(current.columnWidth - owned.columnWidth) < 0.1;
      const nativeColumns = unchanged && owned ? owned.nativeColumns : current.columns;
      const fitted = fitFeedColumns(width, nativeColumns, current.gap.horizontal);
      owned = { ...fitted, nativeColumns };
      if (
        current.columns !== fitted.columns ||
        Math.abs(current.columnWidth - fitted.columnWidth) > 0.1
      )
        current.$patch(fitted);
    } catch {
      failed = current;
      try {
        release();
      } catch {
        /* Site capability disappeared. */
      }
      root.setAttribute(XHS_LAYOUT_STATUS, 'unavailable');
    }
  };
  function schedule() {
    if (!disposed && frame === null) frame = window.requestAnimationFrame(reconcile);
  }
  const config = new MutationObserver(schedule);
  config.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const tree = new MutationObserver(schedule);
  tree.observe(document.body, { childList: true, subtree: true });
  const size = new ResizeObserver(schedule);
  // The body keeps viewport width; the app and feed change when the reservation opens/closes.
  const app = document.querySelector('#app');
  if (app) size.observe(app);
  window.addEventListener('resize', schedule);
  reconcile();
  return () => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    config.disconnect();
    tree.disconnect();
    size.disconnect();
    unsubscribe?.();
    window.removeEventListener('resize', schedule);
    try {
      release();
    } finally {
      root.removeAttribute(XHS_LAYOUT_STATUS);
    }
  };
}
