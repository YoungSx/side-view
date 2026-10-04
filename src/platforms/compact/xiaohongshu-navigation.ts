import type { NativeNavigation } from './native-runtime';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Only the AI navigation renderer consumes sideCollapse. Older navigation is unsupported. */
export function findXiaohongshuNavigation(doc: Document): NativeNavigation | null {
  const element = doc.querySelector<HTMLElement>('.side-bar.side-bar-ai');
  const app = record(record(doc.querySelector('#app'))?.__vue_app__);
  const globals = record(record(app?.config)?.globalProperties);
  const stores = record(globals?.$pinia)?._s;
  const router = record(globals?.$router);
  const store = stores instanceof Map ? record(stores.get('global')) : null;
  if (
    !element ||
    !store ||
    typeof store.sideCollapse !== 'boolean' ||
    typeof store.$patch !== 'function' ||
    typeof router?.afterEach !== 'function'
  )
    return null;

  const patch = store.$patch.bind(store);
  const afterEach = router.afterEach.bind(router);
  let native = store.sideCollapse;
  let removeRouteHook: (() => void) | null = null;
  const collapse = () => {
    if (store.sideCollapse !== true) patch({ sideCollapse: true });
  };
  return {
    element,
    identity: store,
    set(enabled) {
      if (enabled) {
        native = store.sideCollapse as boolean;
        // Native before-navigation guards choose this state, including routes which already
        // want true. Capture it after navigation, before enforcing our preference again.
        const cleanup = afterEach((to: unknown, _from: unknown, failure: unknown) => {
          if (failure) return;
          // The native guard deliberately preserves state on the two chat routes.
          const name = record(to)?.name;
          if (name !== 'AiChat' && name !== 'AiChatTab' && typeof store.sideCollapse === 'boolean')
            native = store.sideCollapse;
          // Reconcile through the controller so runtime failures use its fail-closed path.
          doc.defaultView?.dispatchEvent(new Event('sv:locationchange'));
        });
        if (typeof cleanup !== 'function') throw new Error('Unsupported native route subscription');
        removeRouteHook = cleanup as () => void;
        collapse();
      } else {
        try {
          removeRouteHook?.();
        } finally {
          removeRouteHook = null;
          patch({ sideCollapse: native });
        }
      }
    },
    refresh: collapse,
  };
}
