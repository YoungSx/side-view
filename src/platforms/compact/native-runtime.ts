/** Private site compatibility boundary. Never write fibers, props, hook queues or site CSS. */
interface Hook {
  memoizedState?: unknown;
  queue?: { dispatch?: (value: boolean) => void };
  next?: Hook | null;
}
interface Fiber {
  return?: Fiber | null;
  stateNode?: unknown;
  memoizedProps?: Record<string, unknown>;
  memoizedState?: Hook | null;
}
export interface NativeNavigation {
  element: HTMLElement;
  identity: unknown;
  set(enabled: boolean): void;
  refresh(): void;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
function* ancestors(element: Element): Generator<Fiber> {
  const key = Object.keys(element).find((key) => key.startsWith('__reactFiber$'));
  let fiber = key ? (element as unknown as Record<string, Fiber>)[key] : null;
  for (let depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) yield fiber;
}

export function findXNavigation(doc: Document): NativeNavigation | null {
  const element = doc.querySelector<HTMLElement>('header[role="banner"]');
  if (!element) return null;
  for (const fiber of ancestors(element)) {
    const instance = record(fiber.stateNode);
    const state = record(instance?.state);
    if (
      !instance ||
      !Number.isInteger(state?.sideNavCollapseCount) ||
      typeof state?.isSideNavForceCollaposed !== 'boolean' ||
      typeof instance._getLayoutContextValue !== 'function'
    )
      continue;
    const context = record(
      instance._getLayoutContextValue(
        instance.context,
        Number(state?.grokDrawerSuppressorCount) > 0,
      ),
    );
    const toggle = context?.setSideNavForceCollapased;
    if (typeof toggle !== 'function') return null;
    return {
      element,
      identity: instance,
      // X owns a reference count: the controller acquires once and releases exactly once.
      set: (enabled) => toggle(enabled),
      refresh: () => {},
    };
  }
  return null;
}

const MINIMAL_QUERY = '(max-width: 1300px)';
const LAYOUT_QUERIES = [
  '(min-width: 1100px)',
  '(min-width: 1100px) and (max-width: 1300px)',
  MINIMAL_QUERY,
];

export function findBlueskyNavigation(doc: Document): NativeNavigation | null {
  const element = doc.querySelector<HTMLElement>(
    'main ~ nav[role="navigation"]:has(a[href="/notifications"])',
  );
  if (!element) return null;
  for (const fiber of ancestors(element)) {
    if (typeof fiber.memoizedProps?.routeName !== 'string') continue;
    const hooks: Hook[] = [];
    for (let hook = fiber.memoizedState; hook && hooks.length < 256; hook = hook.next)
      hooks.push(hook);
    const queries = hooks.map((hook) => record(hook.memoizedState)?.media);
    if (!LAYOUT_QUERIES.every((query) => queries.filter((value) => value === query).length === 1))
      continue;
    const media = hooks.find(
      (hook) => record(hook.memoizedState)?.media === MINIMAL_QUERY,
    )?.memoizedState;
    const query = record(media);
    if (
      typeof query?.matches !== 'boolean' ||
      typeof query.addListener !== 'function' ||
      typeof query.removeListener !== 'function' ||
      typeof query.dispose !== 'function'
    )
      return null;
    // react-responsive's useMatches state is identified by its subscribing effect's dependency,
    // not a hook index or minified component name. Reject missing or ambiguous structures.
    const matches = hooks.filter((hook) => {
      const deps = record(hook.next?.memoizedState)?.deps;
      return (
        typeof hook.memoizedState === 'boolean' &&
        typeof hook.queue?.dispatch === 'function' &&
        Array.isArray(deps) &&
        deps.length === 1 &&
        deps[0] === media
      );
    });
    const dispatch = matches.length === 1 ? matches[0]?.queue?.dispatch : null;
    if (!dispatch) return null;
    return {
      element,
      identity: dispatch,
      // Only this mounted navigation's useMatches state is changed. Other consumers, global
      // matchMedia and viewport dimensions remain native. Restore today's breakpoint, not a snapshot.
      set: (enabled) => dispatch(enabled || !!doc.defaultView?.matchMedia(MINIMAL_QUERY).matches),
      refresh: () => dispatch(true),
    };
  }
  return null;
}
