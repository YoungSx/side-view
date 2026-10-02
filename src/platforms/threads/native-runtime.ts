/** Narrow compatibility boundary around Threads' own mounted React router and column actions.
 * No layout writes, custom rendering, direct network calls, or account data extraction.
 */
interface Fiber {
  type?: { $$typeof?: symbol; _context?: unknown };
  return?: Fiber | null;
  memoizedProps?: Record<string, unknown>;
  dependencies?: { firstContext?: Dependency | null };
  memoizedState?: Hook | null;
  updateQueue?: { memoCache?: { data?: unknown } };
}
interface Dependency {
  context: unknown;
  memoizedValue: unknown;
  next?: Dependency | null;
}
interface Hook {
  memoizedState: unknown;
  next?: Hook | null;
}
interface Dispatcher {
  go(url: string, options?: { replace?: boolean; passthroughProps?: Record<string, string> }): void;
  preloadRouteCode?(url: string): void;
}

/** Read the nearest value for each provider without mutating the host React tree. */
export function nativeContexts(element: Element): Map<unknown, unknown> {
  const contexts = new Map<unknown, unknown>();
  for (let f = fiber(element), depth = 0; f && depth < 512; f = f.return ?? null, depth++) {
    const kind = f.type?.$$typeof;
    if (kind !== Symbol.for('react.context') && kind !== Symbol.for('react.provider')) continue;
    const context = f.type?._context ?? f.type;
    if (f.memoizedProps && 'value' in f.memoizedProps && !contexts.has(context))
      contexts.set(context, f.memoizedProps.value);
  }
  return contexts;
}
type UpdateColumn = (args: {
  columnID: string;
  relayRecordID: string;
  relativeURL: string;
}) => void;
export interface NativeColumn {
  element: HTMLElement;
  id: string;
  relayId: string;
  url: string;
  update: UpdateColumn | null;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
function fiber(element: Element): Fiber | null {
  const key = Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
  return key ? ((element as unknown as Record<string, Fiber>)[key] ?? null) : null;
}
function requireContext(): unknown {
  const load = (window as unknown as { require?: (name: string) => unknown }).require;
  if (typeof load !== 'function') return null;
  try {
    return load('CometRouterDispatcherContext');
  } catch {
    return null;
  }
}
export function findDispatcher(element: Element, global = false): Dispatcher | null {
  const context = requireContext();
  if (!context) return null;
  let found: Dispatcher | null = null;
  for (let f = fiber(element), depth = 0; f && depth < 160; f = f.return ?? null, depth++) {
    for (let d = f.dependencies?.firstContext; d; d = d.next) {
      if (d.context !== context || typeof record(d.memoizedValue)?.go !== 'function') continue;
      found = d.memoizedValue as Dispatcher;
      if (!global) return found;
    }
  }
  return found;
}
function nativeAction<T extends (...args: never[]) => void>(
  f: Fiber,
  matches: (source: string) => boolean,
): T | null {
  const found = new Set<T>();
  const scan = (value: unknown, depth = 0): void => {
    if (depth > 5) return;
    if (typeof value === 'function') {
      const source = Function.prototype.toString.call(value);
      if (matches(source)) found.add(value as T);
    } else if (Array.isArray(value)) for (const item of value) scan(item, depth + 1);
  };
  scan(f.updateQueue?.memoCache?.data);
  for (let hook = f.memoizedState, count = 0; hook && count < 100; hook = hook.next, count++)
    scan(hook.memoizedState);
  return found.size === 1 ? ([...found][0] ?? null) : null;
}
export function nativeColumns(): NativeColumn[] {
  const out: NativeColumn[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('[data-deck-column]')) {
    for (let f = fiber(element), depth = 0; f && depth < 100; f = f.return ?? null, depth++) {
      const column = record(f.memoizedProps?.column$key);
      if (!column) continue;
      if (
        typeof column.id === 'string' &&
        typeof column.__id === 'string' &&
        typeof column.uri === 'string'
      ) {
        out.push({
          element,
          id: column.id,
          relayId: column.__id,
          url: column.uri,
          update: nativeAction<UpdateColumn>(
            f,
            (source) =>
              source.includes('Trying to update a column with no changes') &&
              source.includes('relativeURL') &&
              source.includes('columnID'),
          ),
        });
      }
      break;
    }
  }
  return out;
}
export function updateNativeColumn(column: NativeColumn, url: string): boolean {
  if (!column.element.checkVisibility()) return false;
  const anchor = column.element.querySelector('a[href]');
  let reset: ((url: string) => void) | null = null;
  for (
    let f = anchor && fiber(anchor), depth = 0;
    f && depth < 160;
    f = f.return ?? null, depth++
  ) {
    if (record(f.memoizedProps?.column$key)) break;
    // Mounted useBarcelonaColumnRouterReset callback. Reset the native history stack, not
    // merely its last entry; main-page selections begin a new reading session.
    reset = nativeAction<(url: string) => void>(f, (source) =>
      /\{\s*type:\s*["']reset["']\s*,\s*url:/.test(source),
    );
    if (reset) break;
  }
  if (!column.update || !reset) return false;
  // Update the persistent root as well as its current route so Threads retains its own
  // "Remove column" action instead of treating the view as an unpinned child navigation.
  column.update({ columnID: column.id, relayRecordID: column.relayId, relativeURL: url });
  reset(url);
  column.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  return true;
}
export function createNativeColumn(source: Element, url: string, requestId: string): boolean {
  // The home timeline runs in Threads' single-column layout, where the feed is not a deck
  // column and carries no column$key — asking for one first would deadlock. The create
  // callback is mounted on the column regardless, and calling it is what flips the layout
  // to multi-column, so anchor the search on the scrollable timeline itself.
  const element = source.closest<HTMLElement>('[data-column-scrollable]') ?? source;
  if (!element.checkVisibility()) return false;
  for (let f = fiber(element), depth = 0; f && depth < 160; f = f.return ?? null, depth++) {
    // The mounted useBarcelonaCreateColumnMutation callback used by Pin to home. It owns
    // optimistic rendering, persistence and native error feedback. A global router alone
    // proves none of these capabilities (and may only update a hidden cached home page).
    const create = nativeAction<(url: string, requestId: string) => void>(
      f,
      (text) =>
        text.includes('xfb_text_app_board_create_column') &&
        text.includes('optimisticUpdater') &&
        text.includes('connectionRecord') &&
        text.includes('relayRecordID') &&
        text.includes('relativeURL'),
    );
    if (create) {
      create(url, requestId);
      return true;
    }
  }
  return false;
}
