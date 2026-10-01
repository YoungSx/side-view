import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installThreadsNative, NATIVE_CHANNEL } from './native-controller';
import {
  createNativeColumn,
  type NativeColumn,
  nativeColumns,
  updateNativeColumn,
} from './native-runtime';

vi.mock('./native-runtime', () => ({
  nativeColumns: vi.fn(() => []),
  createNativeColumn: vi.fn(),
  updateNativeColumn: vi.fn(),
}));
let dispose: (() => void) | undefined;
let click: (event: MouseEvent) => void;
let columns: NativeColumn[];
let source: HTMLElement;
let link: HTMLAnchorElement;
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://www.threads.com/'));
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: function (this: Element) {
      return this.isConnected && !this.closest('[hidden]');
    },
  });
  document.body.innerHTML =
    '<div data-deck-column><div data-column-scrollable><a href="/@a/post/one">Post</a></div></div>';
  const deck = document.querySelector<HTMLElement>('[data-deck-column]');
  const anchor = document.querySelector<HTMLAnchorElement>('a');
  if (!deck || !anchor) throw new Error('Missing fixture');
  source = deck;
  link = anchor;
  columns = [{ id: '1', relayId: 'home', url: '/for_you', element: source, update: vi.fn() }];
  vi.mocked(nativeColumns).mockImplementation(() => columns);
  vi.mocked(createNativeColumn).mockReset();
  vi.mocked(updateNativeColumn).mockReset();
  const spy = vi.spyOn(document, 'addEventListener');
  dispose = installThreadsNative();
  click = spy.mock.calls.find(([type]) => type === 'click')?.[1] as (event: MouseEvent) => void;
  spy.mockRestore();
});
afterEach(() => {
  dispose?.();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, 'checkVisibility');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function configure(columnId: string | null, enabled = true) {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      origin: location.origin,
      data: { channel: NATIVE_CHANNEL, type: 'config', enabled, includeProfiles: true, columnId },
    }),
  );
}
// jsdom cannot dispatch trusted events. Invoke the actual registered listener with its input contract.
function trustedClick() {
  const preventDefault = vi.fn(),
    stopImmediatePropagation = vi.fn();
  click({
    isTrusted: true,
    defaultPrevented: false,
    button: 0,
    target: link,
    preventDefault,
    stopImmediatePropagation,
  } as unknown as MouseEvent);
  return { preventDefault, stopImmediatePropagation };
}
function addColumn(id = '123', relayId = 'detail') {
  const element = document.createElement('div');
  element.setAttribute('data-deck-column', '');
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  const column = { id, relayId, url: '/@a/post/one', element, update: vi.fn() };
  columns.push(column);
  return column;
}
it('ignores synthetic clicks', () => {
  configure(null);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(createNativeColumn).not.toHaveBeenCalled();
});
it('leaves standalone activity clicks native even when cached home columns remain mounted', () => {
  const owned = addColumn();
  configure(owned.id);
  source.hidden = true;
  owned.element.hidden = true;
  const activity = document.createElement('div');
  activity.setAttribute('data-column-scrollable', '');
  activity.append(link);
  document.body.append(activity);
  vi.stubGlobal('location', new URL('https://www.threads.com/activity'));
  const event = trustedClick();
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
  expect(updateNativeColumn).not.toHaveBeenCalled();
  expect(createNativeColumn).not.toHaveBeenCalled();
});
it('reuses a visible owned column', () => {
  const owned = addColumn();
  configure(owned.id);
  vi.mocked(updateNativeColumn).mockReturnValue(true);
  expect(trustedClick().preventDefault).toHaveBeenCalledOnce();
  expect(updateNativeColumn).toHaveBeenCalledWith(owned, '/@a/post/one');
  expect(createNativeColumn).not.toHaveBeenCalled();
});
it('does not intercept a click inside its detail column', () => {
  const owned = addColumn();
  if (!link.parentElement) throw new Error('Missing scrollable');
  owned.element.append(link.parentElement);
  configure(owned.id);
  expect(trustedClick().preventDefault).not.toHaveBeenCalled();
  expect(updateNativeColumn).not.toHaveBeenCalled();
});
it('requires an actual creation capability, even with a visible deck', () => {
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(false);
  expect(trustedClick().preventDefault).not.toHaveBeenCalled();
});
it('does not impose a pathname blacklist on visible native columns', () => {
  vi.stubGlobal('location', new URL('https://www.threads.com/activity'));
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(true);
  expect(trustedClick().preventDefault).toHaveBeenCalledOnce();
});
it('does not swallow subsequent clicks while a native mutation is pending or schedule deadlines', () => {
  vi.useFakeTimers();
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(true);
  expect(trustedClick().preventDefault).toHaveBeenCalledOnce();
  expect(trustedClick().preventDefault).not.toHaveBeenCalled();
  expect(createNativeColumn).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('records ownership only when the optimistic column receives its saved server ID', async () => {
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(true);
  const post = vi.spyOn(window, 'postMessage');
  trustedClick();
  const requestId = vi.mocked(createNativeColumn).mock.calls[0]?.[2];
  if (!requestId) throw new Error('Missing creation request');
  const optimistic = addColumn('optimistic-id', requestId);
  await Promise.resolve();
  expect(post).not.toHaveBeenCalled();
  optimistic.id = '456';
  optimistic.element.append(document.createElement('span'));
  await Promise.resolve();
  expect(post).toHaveBeenCalledWith(
    { channel: NATIVE_CHANNEL, type: 'owned', columnId: '456' },
    location.origin,
  );
  vi.mocked(updateNativeColumn).mockReturnValue(true);
  trustedClick();
  expect(updateNativeColumn).toHaveBeenCalledWith(optimistic, '/@a/post/one');
});
it('clears pending creation when the native optimistic column is rolled back', async () => {
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(true);
  trustedClick();
  const requestId = vi.mocked(createNativeColumn).mock.calls[0]?.[2];
  if (!requestId) throw new Error('Missing creation request');
  const optimistic = addColumn('optimistic-id', requestId);
  await Promise.resolve();
  optimistic.element.remove();
  columns = columns.filter((c) => c !== optimistic);
  await Promise.resolve();
  trustedClick();
  expect(createNativeColumn).toHaveBeenCalledTimes(2);
});
it('records a completed creation after navigation hides the deck without scrolling it', async () => {
  configure(null);
  vi.mocked(createNativeColumn).mockReturnValue(true);
  trustedClick();
  const requestId = vi.mocked(createNativeColumn).mock.calls[0]?.[2];
  if (!requestId) throw new Error('Missing creation request');
  const optimistic = addColumn('optimistic-id', requestId);
  await Promise.resolve();
  source.hidden = true;
  optimistic.element.hidden = true;
  optimistic.id = '456';
  const post = vi.spyOn(window, 'postMessage');
  optimistic.element.append(document.createElement('span'));
  await Promise.resolve();
  expect(post).toHaveBeenCalledWith(
    { channel: NATIVE_CHANNEL, type: 'owned', columnId: '456' },
    location.origin,
  );
  expect(optimistic.element.scrollIntoView).not.toHaveBeenCalled();
});
it('forgets a removed column from the active deck without a timer or creating a replacement', async () => {
  const owned = addColumn();
  configure(owned.id);
  const post = vi.spyOn(window, 'postMessage');
  owned.element.remove();
  columns = columns.filter((c) => c !== owned);
  await Promise.resolve();
  expect(post).toHaveBeenCalledWith(
    { channel: NATIVE_CHANNEL, type: 'owned', columnId: null },
    location.origin,
  );
  expect(createNativeColumn).not.toHaveBeenCalled();
});
it('preserves ownership when the deck unmounts during navigation', async () => {
  const owned = addColumn();
  configure(owned.id);
  const post = vi.spyOn(window, 'postMessage');
  document.body.replaceChildren();
  columns = [];
  await Promise.resolve();
  expect(post).not.toHaveBeenCalled();
});
it('preserves ownership when a native rerender replaces its DOM node', async () => {
  const owned = addColumn();
  configure(owned.id);
  const post = vi.spyOn(window, 'postMessage');
  owned.element.remove();
  columns = columns.filter((c) => c !== owned);
  addColumn(owned.id);
  await Promise.resolve();
  expect(post).not.toHaveBeenCalled();
});
it('leaves the original click untouched if a native action throws', () => {
  configure(null);
  vi.mocked(createNativeColumn).mockImplementation(() => {
    throw new Error('changed native contract');
  });
  expect(trustedClick().preventDefault).not.toHaveBeenCalled();
});
