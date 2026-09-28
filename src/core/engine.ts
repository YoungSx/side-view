import type { ContentScriptContext } from '#imports';
import { ClickRouter, type InterceptPolicy } from '@/core/click-router';
import { log } from '@/core/log';
import { observeRoute } from '@/core/route-observer';
import { ShadowLayoutController } from '@/layout/shadow-layout-controller';
import { pickAdapter } from '@/platforms/registry';
import { IframeColumnProvider } from '@/providers/iframe/iframe-provider';
import { loadSettings, settings } from '@/settings/storage';

/** Status is always intercepted (the core feature); other kinds only when the user opts in. */
function makePolicy(includeProfilesAndTags: boolean): InterceptPolicy {
  return (kind) => kind === 'status' || includeProfilesAndTags;
}

/**
 * Wire the platform-agnostic engine on the top frame: pick the adapter, mount the layout + detail
 * provider, install click interception, and keep everything live as settings change and the host
 * app re-renders. Every listener/observer/watcher registers its cleanup through `ctx`.
 */
export async function startSideView(ctx: ContentScriptContext): Promise<void> {
  const snapshot = await loadSettings();
  if (!snapshot.enabled) return;

  const adapter = pickAdapter(new URL(location.href), snapshot.selectorOverrides);
  if (!adapter) return;

  log.debug('selector self-check', adapter.runSelfCheck());

  const provider = new IframeColumnProvider(adapter);
  const layout = new ShadowLayoutController(ctx, adapter, snapshot.columnWidth);
  await layout.attach(snapshot.layoutMode, {
    onMount: (container) => provider.mount(container),
    onRemove: () => provider.unmount(),
  });

  const router = new ClickRouter(
    adapter,
    (intent) => provider.open(intent),
    makePolicy(snapshot.interceptProfilesAndTags),
    () => layout.isColumnVisible(), // don't hijack clicks while the column is hidden (sub-breakpoint)
  );
  router.install(ctx);

  // Secondary guard: re-attach if a route change tore the host down while autoMount lagged.
  observeRoute(ctx, () => layout.reattachIfDetached());

  // Live settings — the options page can retune the running content script.
  ctx.onInvalidated(settings.layoutMode.watch((mode) => layout.setMode(mode)));
  ctx.onInvalidated(settings.columnWidth.watch((px) => layout.setWidth(px)));
  ctx.onInvalidated(
    settings.interceptProfilesAndTags.watch((v) => router.setPolicy(makePolicy(v))),
  );
}
