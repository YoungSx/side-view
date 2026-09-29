import { defineContentScript, storage } from '#imports';
import { NATIVE_CHANNEL } from '@/platforms/threads/native-controller';
import { settings } from '@/settings/storage';

const ownedColumn = storage.defineItem<string | null>('local:threadsNativeColumnId', {
  fallback: null,
});
export default defineContentScript({
  matches: ['https://*.threads.com/*', 'https://*.threads.net/*'],
  runAt: 'document_idle',
  async main(ctx) {
    let sequence = 0;
    const send = async () => {
      const request = ++sequence;
      const [enabled, includeProfiles, columnId] = await Promise.all([
        settings.enabled.getValue(),
        settings.interceptProfilesAndTags.getValue(),
        ownedColumn.getValue(),
      ]);
      if (ctx.isInvalid || request !== sequence) return;
      window.postMessage(
        { channel: NATIVE_CHANNEL, type: 'config', enabled, includeProfiles, columnId },
        location.origin,
      );
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.channel !== NATIVE_CHANNEL
      )
        return;
      if (event.data.type === 'ready') void send();
      if (
        event.data.type === 'owned' &&
        (event.data.columnId === null ||
          (typeof event.data.columnId === 'string' && /^\d+$/.test(event.data.columnId)))
      )
        void ownedColumn.setValue(event.data.columnId);
    };
    window.addEventListener('message', receive);
    ctx.onInvalidated(() => window.removeEventListener('message', receive));
    ctx.onInvalidated(settings.enabled.watch(() => void send()));
    ctx.onInvalidated(settings.interceptProfilesAndTags.watch(() => void send()));
    ctx.onInvalidated(ownedColumn.watch(() => void send()));
    await send();
  },
});
