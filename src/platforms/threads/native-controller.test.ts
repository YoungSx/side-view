import { afterEach, expect, it, vi } from 'vitest';
import { installThreadsNative, NATIVE_CHANNEL } from './native-controller';
import { createNativeColumn, nativeColumns } from './native-runtime';

vi.mock('./native-runtime', () => ({
  nativeColumns: vi.fn(() => []),
  createNativeColumn: vi.fn(),
  updateNativeColumn: vi.fn(),
}));
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(nativeColumns).mockReturnValue([]);
});
function configure(columnId: string | null) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      origin: location.origin,
      data: {
        channel: NATIVE_CHANNEL,
        type: 'config',
        enabled: true,
        includeProfiles: false,
        columnId,
      },
    }),
  );
}
it('forgets ownership after native removal without mutating the page or creating another column', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div data-deck-column></div>';
  const element = document.querySelector<HTMLElement>('[data-deck-column]');
  if (!element) throw new Error('Fixture missing');
  vi.stubGlobal('location', new URL('https://www.threads.com/'));
  vi.mocked(nativeColumns).mockReturnValue([
    { id: '123', relayId: 'r', url: '/@a/post/one', element, update: null },
  ]);
  const message = vi.spyOn(window, 'postMessage');
  dispose = installThreadsNative();
  configure('123');
  element.remove();
  vi.mocked(nativeColumns).mockReturnValue([]);
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(701);
  expect(message).toHaveBeenCalledWith(
    { channel: NATIVE_CHANNEL, type: 'owned', columnId: null },
    location.origin,
  );
  expect(createNativeColumn).not.toHaveBeenCalled();
  expect(document.querySelector('iframe')).toBeNull();
  vi.unstubAllGlobals();
});
it('ignores synthetic clicks rather than letting page scripts create saved columns', () => {
  document.body.innerHTML = '<div data-column-scrollable><a href="/@a/post/one">Post</a></div>';
  dispose = installThreadsNative();
  configure(null);
  document
    .querySelector('a')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(createNativeColumn).not.toHaveBeenCalled();
});
