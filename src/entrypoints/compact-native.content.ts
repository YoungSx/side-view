import { defineContentScript } from '#imports';
import { installNativeNavigation } from '@/platforms/compact/native-controller';

export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*', 'https://bsky.app/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    const scope = window as unknown as { __sideViewNavigationCleanup?: () => void };
    scope.__sideViewNavigationCleanup?.();
    scope.__sideViewNavigationCleanup = installNativeNavigation();
  },
});
