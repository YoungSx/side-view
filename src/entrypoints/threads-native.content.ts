import { defineContentScript } from '#imports';
import { installThreadsNative } from '@/platforms/threads/native-controller';
export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    const scope = window as unknown as { __sideViewThreadsCleanup?: () => void };
    scope.__sideViewThreadsCleanup?.();
    scope.__sideViewThreadsCleanup = installThreadsNative();
  },
});
