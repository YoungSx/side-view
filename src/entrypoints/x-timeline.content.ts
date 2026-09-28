import { defineContentScript } from '#imports';
import { startSideView } from '@/core/engine';
import { log } from '@/core/log';
import '@/ui/styles/shadow.css';

// Top-frame engine on X. `all_frames` stays false, so this never runs inside our own detail
// iframe. `cssInjectionMode: 'ui'` sends the imported shadow.css into the column's shadow root.
export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    try {
      await startSideView(ctx);
    } catch (error) {
      log.error('failed to start', error);
    }
  },
});
