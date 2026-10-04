import { defineContentScript } from '#imports';
import { installFeedLayout } from '@/platforms/xiaohongshu/native-layout';

export default defineContentScript({
  matches: ['https://www.xiaohongshu.com/*'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    const scope = window as unknown as { __sideViewXiaohongshuCleanup?: () => void };
    scope.__sideViewXiaohongshuCleanup?.();
    scope.__sideViewXiaohongshuCleanup = installFeedLayout();
  },
});
