/** Narrow compatibility boundary around Threads' own mounted React router and column actions.
 * No layout writes, custom rendering, direct network calls, or account data extraction.
 */
interface Fiber {
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
function updateAction(f: Fiber): UpdateColumn | null {
  const found = new Set<UpdateColumn>();
  const scan = (value: unknown, depth = 0): void => {
    if (depth > 5) return;
    if (typeof value === 'function') {
      // Signature from the live native useBarcelonaUpdateColumnMutation callback. Fail closed
      // when the site changes rather than calling an arbitrary function in its component cache.
      const source = Function.prototype.toString.call(value);
      if (
        source.includes('Trying to update a column with no changes') &&
        source.includes('relativeURL') &&
        source.includes('columnID')
      )
        found.add(value as UpdateColumn);
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
          update: updateAction(f),
        });
      }
      break;
    }
  }
  return out;
}
export function updateNativeColumn(column: NativeColumn, url: string): boolean {
  const anchor = column.element.querySelector('a[href]');
  const dispatcher = anchor && findDispatcher(anchor);
  if (!column.update || !dispatcher) return false;
  // Update the persistent root as well as its current route so Threads retains its own
  // "Remove column" action instead of treating the view as an unpinned child navigation.
  column.update({ columnID: column.id, relayRecordID: column.relayId, relativeURL: url });
  dispatcher.go(url, { replace: true });
  column.element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  return true;
}
export function createNativeColumn(source: Element, url: string, requestId: string): boolean {
  const dispatcher = findDispatcher(source, true);
  if (!dispatcher) return false;
  dispatcher.go('/', { passthroughProps: { newColumnID: requestId, newColumnURL: url } });
  return true;
}
