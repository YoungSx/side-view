import { defineContentScript } from '#imports';

// MAIN-world bridge. The isolated engine can't see the page's real History object, so this patches
// pushState/replaceState in page context and re-broadcasts each navigation as `sv:locationchange`.
// popstate covers back/forward. This is a redundant fallback — where the Navigation API works, the
// engine already hears navigations without it. Side-effect only; no chrome.* usage (MAIN world).
export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*', 'https://bsky.app/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const fire = (): void => {
      window.dispatchEvent(new Event('sv:locationchange'));
    };

    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
      originalPush(...args);
      fire();
    };
    history.replaceState = (...args) => {
      originalReplace(...args);
      fire();
    };
    window.addEventListener('popstate', fire);
  },
});
