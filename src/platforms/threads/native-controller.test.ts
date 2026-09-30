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
let clickListener: ((event: MouseEvent) => void) | null = null;
// jsdom hard-codes `isTrusted` to false and it is not redefinable, so drive the registered
// capture listener with a stand-in event instead of a dispatched one.
function install(): void {
  const spy = vi.spyOn(document, 'addEventListener');
  dispose = installThreadsNative();
  clickListener = spy.mock.calls.find(([type]) => type === 'click')?.[1] as (
    event: MouseEvent,
  ) => void;
  spy.mockRestore();
}
function trustedClick(href: string): boolean {
  document.body.innerHTML = `<div data-column-scrollable><a href="${href}">Post</a></div>`;
  let prevented = false;
  clickListener?.({
    isTrusted: true,
    defaultPrevented: false,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: document.querySelector('a'),
    preventDefault: () => {
      prevented = true;
    },
    stopImmediatePropagation: () => {},
  } as unknown as MouseEvent);
  return prevented;
}
it('replays the click natively when Threads never creates the requested column', async () => {
  vi.useFakeTimers();
  const assign = vi.fn();
  vi.stubGlobal('location', {
    origin: 'https://www.threads.com',
    href: 'https://www.threads.com/',
    assign,
  });
  vi.mocked(createNativeColumn).mockReturnValue(true); // dispatcher found, column never appears
  install();
  configure(null);
  expect(trustedClick('/@a/post/one')).toBe(true);
  await vi.advanceTimersByTimeAsync(1501);
  expect(assign).toHaveBeenCalledWith('/@a/post/one');
  vi.unstubAllGlobals();
});
it('keeps the click when the column does materialise with the requested url', async () => {
  vi.useFakeTimers();
  const assign = vi.fn();
  vi.stubGlobal('location', {
    origin: 'https://www.threads.com',
    href: 'https://www.threads.com/',
    assign,
  });
  const element = document.createElement('div');
  element.scrollIntoView = vi.fn();
  vi.mocked(createNativeColumn).mockImplementation((_source, _url, requestId) => {
    vi.mocked(nativeColumns).mockReturnValue([
      { id: '123', relayId: requestId, url: '/@a/post/one', element, update: null },
    ]);
    return true;
  });
  install();
  configure(null);
  expect(trustedClick('/@a/post/one')).toBe(true);
  document.body.appendChild(element); // let the observer see Threads' new column
  await vi.advanceTimersByTimeAsync(1501);
  expect(assign).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
