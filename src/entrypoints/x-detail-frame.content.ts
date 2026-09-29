import { defineContentScript } from '#imports';
import { pickAdapter } from '@/platforms/registry';
import { SV_DETAIL_FRAME_STYLE_ID } from '@/platforms/x/detail-frame-css';

// Runs in ALL frames but acts ONLY inside our detail iframe — identified by `window.name`, set by
// the provider before the iframe's `src`. There it strips X's own chrome so just the thread shows.
// A persistent <style> plus a MutationObserver re-inject it if X's in-frame React removes the node.
export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    const adapter = pickAdapter(new URL(location.href));
    if (!adapter) return;
    if (window.top === window.self) return;
    // Chrome can clear window.name on navigation; the same-origin iframe element keeps its name.
    const frameName = window.frameElement?.getAttribute('name') ?? window.name;
    if (frameName !== adapter.detailFrameName) return;
    installChromeStripper(adapter.detailFrameCss());
  },
});

function installChromeStripper(css: string): void {
  const ensure = (): void => {
    if (document.getElementById(SV_DETAIL_FRAME_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SV_DETAIL_FRAME_STYLE_ID;
    style.textContent = css;
    (document.head ?? document.documentElement).appendChild(style);
  };
  ensure();
  new MutationObserver(ensure).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
