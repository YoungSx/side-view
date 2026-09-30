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
// ponytail: fixed settle window. A column that has not materialised (or changed URL) by then is
// treated as unsupported by this route — e.g. Threads routes that ignore the column passthrough
// props — and the click is replayed natively instead of being swallowed. Raise only if slow
// devices show false fallbacks.
const SETTLE_MS = 1500;
const pathOf = (value: string): string => {
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
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let servedCheck: (() => boolean) | null = null;
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
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    servedCheck = null;
    pending = null;
  };
  // A click is only ever swallowed when the column really shows the target. `createNativeColumn`
  // and `updateNativeColumn` merely report that a dispatcher existed, so this is the only place
  // that can tell "supported" from "Threads ignored us".
  const armSettle = (url: string, served: () => boolean) => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    servedCheck = served;
    settleTimer = setTimeout(() => {
      const check = servedCheck;
      servedCheck = null;
      settleTimer = null;
      if (check && !check()) location.assign(url);
    }, SETTLE_MS);
  };
  const columnUrl = (id: string): string => nativeColumns().find((c) => c.id === id)?.url ?? '';
  const checkPending = () => {
    if (!pending || !config) return;
    const column = nativeColumns().find((c) => c.relayId === pending?.requestId);
    if (!column || !/^\d+$/.test(column.id) || pending.before.has(column.id)) return;
    const url = pending.url;
    config.columnId = column.id;
    knownOwned = column.element;
    report(column.id);
    clear();
    if (pathOf(column.url) !== pathOf(url) && !updateNativeColumn(column, url)) {
      location.assign(url); // our column cannot show the target; let the page navigate
      return;
    }
    column.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
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
    const url = new URL(intent.url);
    const relative = url.pathname + url.search;
    try {
      let accepted = false;
      if (pending) {
        pending.url = relative;
        accepted = true;
      } else if (owned) accepted = updateNativeColumn(owned, relative);
      else {
        // Never create a duplicate just because an existing deck is absent on a standalone route.
        if (config.columnId && !document.querySelector('[data-deck-column]')) return;
        const requestId = crypto.randomUUID();
        pending = { requestId, url: relative, before: new Set(nativeColumns().map((c) => c.id)) };
        observer.observe(document.body, { childList: true, subtree: true });
        accepted = createNativeColumn(target, relative, requestId);
        if (!accepted) clear();
      }
      if (!accepted) return;
      if (pending) armSettle(pending.url, () => pending === null);
      else if (owned) armSettle(relative, () => pathOf(columnUrl(owned.id)) === pathOf(relative));
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
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
