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
// ponytail: fallback deadline for opening a column, and nothing else. `createNativeColumn`
// returns true as soon as it finds a dispatcher, never on proof that Threads honoured the
// passthrough props, so this is the only thing standing between a click that was swallowed and a
// click that goes nowhere. Reusing a column needs no deadline — `updateAction` fails closed, which
// leaves the click to Threads. Delete once column opening can be confirmed synchronously.
const OPEN_FALLBACK_MS = 1500;

export function installThreadsNative(): () => void {
  let config: NativeConfig | null = null;
  let pending: { requestId: string; url: string; before: Set<string> } | null = null;
  let openFallback: ReturnType<typeof setTimeout> | null = null;
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
    if (openFallback !== null) clearTimeout(openFallback);
    openFallback = null;
    pending = null;
  };
  const checkPending = () => {
    if (!pending || !config) return;
    const column = nativeColumns().find((c) => c.relayId === pending?.requestId);
    if (!column || !/^\d+$/.test(column.id) || pending.before.has(column.id)) return;
    const url = pending.url;
    config.columnId = column.id;
    knownOwned = column.element;
    report(column.id);
    clear();
    if (column.url !== url) updateNativeColumn(column, url);
    column.element.scrollIntoView(SCROLL);
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
    // Threads takes the passthrough url and its column router relative to the current origin.
    const { pathname, search } = new URL(intent.url);
    const relative = pathname + search;
    try {
      if (pending) {
        pending.url = relative; // a column is already opening; retarget it
      } else if (owned) {
        if (!updateNativeColumn(owned, relative)) return;
      } else {
        // Refuse before swallowing when a recorded column is gone: recreating it here would open
        // a duplicate the user never asked for.
        if (config.columnId && !document.querySelector('[data-deck-column]')) return;
        const requestId = crypto.randomUUID();
        pending = { requestId, url: relative, before: new Set(nativeColumns().map((c) => c.id)) };
        observer.observe(document.body, { childList: true, subtree: true });
        if (!createNativeColumn(target, relative, requestId)) {
          clear();
          return;
        }
        // Nothing above proves Threads opened anything. If the column has not turned up by the
        // deadline, send the click where it was always headed instead of dropping it.
        openFallback = setTimeout(() => {
          const url = pending?.url;
          clear();
          if (url) location.assign(url);
        }, OPEN_FALLBACK_MS);
      }
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
