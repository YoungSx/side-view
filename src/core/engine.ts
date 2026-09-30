import type { ContentScriptContext } from '#imports';
import { ClickRouter, type InterceptPolicy } from '@/core/click-router';
import { log } from '@/core/log';
import { observeRoute } from '@/core/route-observer';
import { applyStoredLanguage, setUiLanguage } from '@/i18n/runtime';
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
  // Before the first i18n.t() so the detail column's labels render in the stored language.
  await applyStoredLanguage();
  const snapshot = await loadSettings();
  if (!snapshot.enabled) return;

  const adapter = pickAdapter(new URL(location.href), snapshot.selectorOverrides);
  if (!adapter) return;

  log.debug('selector self-check', adapter.runSelfCheck());

  const layout = new ShadowLayoutController(ctx, adapter, snapshot.columnWidth);
  const provider = new IframeColumnProvider(adapter, () => layout.close());
  await layout.initialize(snapshot.layoutMode, {
    onMount: (container) => provider.mount(container),
    onRemove: () => provider.unmount(),
  });
  if (ctx.isInvalid) return;
  layout.setCompactNavigation(snapshot.compactNavigation);

  const router = new ClickRouter(
    adapter,
    (intent) => {
      provider.open(intent);
      if (layout.open()) return true;
      layout.close();
      provider.destroy();
      return false;
    },
    makePolicy(snapshot.interceptProfilesAndTags),
  );
  router.install(ctx);
  ctx.onInvalidated(() => provider.destroy());

  // Route events provide an additional opportunity to reconcile the column.
  observeRoute(ctx, () => layout.reattachIfDetached());

  // Live settings — the options page can retune the running content script.
  ctx.onInvalidated(settings.layoutMode.watch((mode) => layout.setMode(mode)));
  ctx.onInvalidated(settings.columnWidth.watch((px) => layout.setWidth(px)));
  ctx.onInvalidated(
    settings.compactNavigation.watch((enabled) => layout.setCompactNavigation(enabled)),
  );
  ctx.onInvalidated(
    settings.interceptProfilesAndTags.watch((v) => router.setPolicy(makePolicy(v))),
  );
  // Labels are baked in at render time, so a language change needs the column redrawn.
  ctx.onInvalidated(
    settings.uiLanguage.watch(async (language) => {
      await setUiLanguage(language);
      provider.refreshLabels();
    }),
  );
}
