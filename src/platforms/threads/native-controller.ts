import type { NativeColumn } from './native-runtime';
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
// ponytail: fixed settle window. A column that has not materialised (or changed URL) by then is
// treated as unsupported by this route — e.g. Threads routes that ignore the column passthrough
// props — and the click is replayed natively instead of being swallowed. Raise only if slow
// devices show false fallbacks.
const SETTLE_MS = 1500;

/** Path + query, so Threads' column uri compares equal whether it is stored absolute or relative. */
const pathOf = (value: string): string => {
  if (!value) return '';
  try {
    const url = new URL(value, location.origin);
    return url.pathname + url.search;
  } catch {
    return value;
  }
};
export function installThreadsNative(): () => void {
  let config: NativeConfig | null = null;
  let pending: { requestId: string; url: string; before: Set<string> } | null = null;
  let settle: { timer: ReturnType<typeof setTimeout>; served: () => boolean } | null = null;
  let knownOwned: HTMLElement | null = null;
  let removalTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => checkPending());
  const removalObserver = new MutationObserver(() => {
    if (!knownOwned || knownOwned.isConnected || pending || removalTimer !== null) return;
    removalTimer = setTimeout(() => {
      removalTimer = null;
      const current = nativeColumns().find((c) => c.id === config?.columnId);
      if (current) {
        knownOwned = current.element;
        return;
      }
      if (location.pathname === '/' && config && knownOwned && !knownOwned.isConnected) {
        config.columnId = null;
        knownOwned = null;
        report(null);
      }
    }, 700);
  });
  const report = (columnId: string | null) =>
    window.postMessage({ channel: NATIVE_CHANNEL, type: 'owned', columnId }, location.origin);
  const clear = () => {
    observer.disconnect();
    if (settle !== null) clearTimeout(settle.timer);
    settle = null;
    pending = null;
  };
  /**
   * The one exit for a click we could not serve.
   *
   * Threads' runtime only reports that a React dispatcher existed, never that it honoured the
   * request, so a swallowed click must be proven served before the settle window closes. `served`
   * is therefore always the same question — "does the column we asked for now show the target?" —
   * and it is asked again at the deadline rather than trusted at request time.
   */
  const armSettle = (url: string, served: () => boolean) => {
    if (settle !== null) clearTimeout(settle.timer);
    const timer = setTimeout(() => {
      if (settle?.timer === timer) settle = null;
      if (!served()) location.assign(url);
    }, SETTLE_MS);
    settle = { timer, served };
  };
  const showsTarget = (match: (column: NativeColumn) => boolean, wanted: string) => () =>
    pathOf(nativeColumns().find(match)?.url ?? '') === wanted;
  const checkPending = () => {
    if (!pending || !config) return;
    const column = nativeColumns().find((c) => c.relayId === pending?.requestId);
    if (!column || !/^\d+$/.test(column.id) || pending.before.has(column.id)) return;
    const url = pending.url;
    config.columnId = column.id;
    knownOwned = column.element;
    report(column.id);
    clear(); // drops the settle, so a later failure below is the only remaining way out
    if (pathOf(column.url) === pathOf(url)) {
      column.element.scrollIntoView(SCROLL);
      return;
    }
    // Threads opened the column but ignored the requested url, and the column update is the only
    // way left to land on the target. When that is impossible the page navigates, never silence.
    if (!updateNativeColumn(column, url)) location.assign(url);
    else column.element.scrollIntoView(SCROLL);
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
    knownOwned = nativeColumns().find((c) => c.id === data.columnId)?.element ?? knownOwned;
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
    if (!target.closest('[data-column-scrollable]')) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const owned = nativeColumns().find((c) => c.id === config?.columnId);
    if (owned?.element.contains(target)) return; // native interactions inside the detail remain native
    let link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link) {
      const post = target.closest('[data-pressable-container="true"]');
      link = post?.querySelector<HTMLAnchorElement>('a[href*="/post/"]') ?? null;
    }
    if (!link) return;
    const intent = resolveThreadsUrl(link.getAttribute('href') ?? '', new URL(location.href));
    if (!intent || (intent.kind !== 'status' && !config.includeProfiles)) return;
    const relative = pathOf(intent.url);
    try {
      // Each branch answers the same question — which column should now show `relative`? — and
      // returns how to check it. A click is swallowed only after a branch produced a predicate.
      let served: (() => boolean) | null = null;
      if (pending) {
        const { requestId } = pending; // the in-flight column, identified by value not by ref
        pending.url = relative; // a column is already on its way; retarget it
        served = showsTarget((c) => c.relayId === requestId, relative);
      } else if (owned) {
        const { id } = owned;
        if (!updateNativeColumn(owned, relative)) return;
        served = showsTarget((c) => c.id === id, relative);
      } else {
        // Never create a duplicate just because an existing deck is absent on a standalone route.
        if (config.columnId && !document.querySelector('[data-deck-column]')) return;
        const requestId = crypto.randomUUID();
        pending = { requestId, url: relative, before: new Set(nativeColumns().map((c) => c.id)) };
        observer.observe(document.body, { childList: true, subtree: true });
        if (!createNativeColumn(target, relative, requestId)) {
          clear();
          return;
        }
        served = showsTarget((c) => c.relayId === requestId, relative);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      armSettle(relative, served);
    } catch {
      clear();
    } // untouched original click follows Threads when capability probing fails
  };
  removalObserver.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('message', message);
  document.addEventListener('click', click, true);
  window.postMessage({ channel: NATIVE_CHANNEL, type: 'ready' }, location.origin);
  return () => {
    clear();
    removalObserver.disconnect();
    if (removalTimer !== null) clearTimeout(removalTimer);
    window.removeEventListener('message', message);
    document.removeEventListener('click', click, true);
  };
}
