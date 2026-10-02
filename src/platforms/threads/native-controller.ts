import { ThreadsNativePanel } from './native-panel';
import { createNativeColumn, nativeColumns, updateNativeColumn } from './native-runtime';
import { resolveThreadsUrl } from './url';

export interface NativeConfig {
  enabled: boolean;
  includeProfiles: boolean;
  columnId: string | null;
}
export const NATIVE_CHANNEL = 'side-view:threads-native:v1';
const INTERACTIVE =
  'button,[role="button"],[role="menuitem"],input,textarea,select,video,[contenteditable="true"]';
const SCROLL: ScrollIntoViewOptions = { block: 'nearest', inline: 'nearest', behavior: 'auto' };
export function installThreadsNative(): () => void {
  let config: NativeConfig | null = null;
  let pending: { requestId: string; optimistic: HTMLElement | null } | null = null;
  let knownOwned: HTMLElement | null = null;
  const panel = new ThreadsNativePanel();
  const observer = new MutationObserver(() => reconcile());
  const report = (columnId: string | null) =>
    window.postMessage({ channel: NATIVE_CHANNEL, type: 'owned', columnId }, location.origin);
  const reconcile = () => {
    if (!config) return;
    panel.reconcile();
    if (config.enabled) panel.prepare();
    // Feed mutations are frequent; inspect native React actions only while ownership changes.
    if (!pending && (knownOwned?.isConnected || !config.columnId)) return;
    const columns = nativeColumns();
    const columnId = config.columnId;
    const current = columns.find((c) => c.id === columnId);
    if (current) knownOwned = current.element;
    // Forget a recorded column that is gone from an otherwise populated deck. The empty-deck
    // case is deliberately not handled here: columns unmount transiently during navigation,
    // which is indistinguishable from "nothing is pinned".
    else if (columnId && columns.some((c) => c.element.checkVisibility())) {
      config.columnId = null;
      knownOwned = null;
      report(null);
    }
    if (!pending) return;
    const column = columns.find((c) => c.relayId === pending?.requestId);
    if (!column) {
      // A native mutation failure removes its optimistic column and shows Threads' own toast.
      if (pending.optimistic && columns.length > 0) pending = null;
      return;
    }
    pending.optimistic = column.element;
    if (!/^\d+$/.test(column.id)) return;
    config.columnId = column.id;
    knownOwned = column.element;
    pending = null;
    report(column.id);
    if (column.element.checkVisibility()) column.element.scrollIntoView(SCROLL);
  };
  const message = (event: MessageEvent) => {
    const data = event.data;
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      data?.channel !== NATIVE_CHANNEL ||
      data.type !== 'config'
    )
      return;
    if (
      typeof data.enabled !== 'boolean' ||
      typeof data.includeProfiles !== 'boolean' ||
      !(data.columnId === null || typeof data.columnId === 'string')
    )
      return;
    config = {
      enabled: data.enabled,
      includeProfiles: data.includeProfiles,
      columnId: data.columnId,
    };
    knownOwned = nativeColumns().find((c) => c.id === data.columnId)?.element ?? null;
    if (!config.enabled) {
      pending = null;
      panel.close();
    } else panel.prepare();
  };
  const click = (event: MouseEvent) => {
    if (
      !event.isTrusted ||
      !config?.enabled ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(INTERACTIVE)) return;
    if (
      panel.contains(target) ||
      target.closest('[role="dialog"],[aria-modal="true"],[role="tablist"]')
    )
      return;
    const scrollable = target.closest<HTMLElement>('[data-column-scrollable]');
    if (!scrollable?.checkVisibility()) return;
    // Cached home columns never serve standalone clicks; those use an ephemeral native panel.
    const source = target.closest('[data-deck-column]');
    if (source && !source.checkVisibility()) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    reconcile();
    const owned = nativeColumns().find((c) => c.id === config?.columnId);
    if (owned?.element.contains(target)) return; // native interactions inside the detail remain native
    let link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link) {
      const post = target.closest('[data-pressable-container="true"]');
      link = post?.querySelector<HTMLAnchorElement>('a[href*="/post/"]') ?? null;
    }
    if (!link) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const intent = resolveThreadsUrl(link.getAttribute('href') ?? '', new URL(location.href));
    if (!intent || (intent.kind !== 'status' && !config.includeProfiles)) return;
    // Native column actions and routing take a path relative to the current origin.
    const { pathname, search } = new URL(intent.url);
    const relative = pathname + search;
    try {
      // A recorded column that is not on screen cannot be retargeted. On the home timeline
      // Threads mounts every pinned column, so its absence means the column is gone; keeping
      // the id would strand this click on the fallback panel for the rest of the session.
      if (config.columnId && !owned && new URL(location.href).pathname === '/') {
        config.columnId = null;
        report(null);
      }
      // Prefer Threads' own column: reuse the one we own, otherwise create one. The
      // ephemeral panel is only a fallback for routes that expose no column capability.
      // Reuse stays gated on a deck column so a standalone route never hijacks the
      // pinned home column.
      if (pending) return; // no confirmed detail to retarget yet; let Threads handle this click
      if (owned && source) {
        if (!updateNativeColumn(owned, relative)) return;
      } else if (!config.columnId) {
        const requestId = crypto.randomUUID();
        pending = { requestId, optimistic: null };
        if (!createNativeColumn(scrollable, relative, requestId)) {
          pending = null;
          if (!panel.open(scrollable, relative)) return;
        }
      } else if (!panel.open(scrollable, relative)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch {
      pending = null;
    } // untouched original click follows Threads when capability probing fails
  };
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('message', message);
  document.addEventListener('click', click, true);
  window.postMessage({ channel: NATIVE_CHANNEL, type: 'ready' }, location.origin);
  return () => {
    pending = null;
    panel.close();
    observer.disconnect();
    window.removeEventListener('message', message);
    document.removeEventListener('click', click, true);
  };
}
