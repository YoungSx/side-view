import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createNativeColumn,
  findDispatcher,
  nativeColumns,
  updateNativeColumn,
} from './native-runtime';

const context = {};
const calls: unknown[] = [];
function update(args: { columnID: string; relativeURL: string; relayRecordID: string }) {
  if (!args.columnID || !args.relativeURL)
    throw new Error('Trying to update a column with no changes');
  calls.push(args);
}
const globalGo = vi.fn(),
  localGo = vi.fn();
const created = vi.fn();
function create(url: string, requestId: string) {
  // Contract-shaped fixture for the mounted native callback; no network is involved.
  created({
    xfb_text_app_board_create_column: true,
    optimisticUpdater: { connectionRecord: 'connection', relayRecordID: requestId },
    relativeURL: url,
  });
}
function fixture() {
  document.body.innerHTML = '<div data-deck-column><a href="/@alice/post/one">Post</a></div>';
  const el = document.querySelector<HTMLElement>('[data-deck-column]');
  const link = el?.querySelector('a');
  if (!el || !link) throw new Error('Fixture missing');
  const root = {
    memoizedProps: { column$key: { id: '123', __id: 'relay-123', uri: '/@alice/post/one' } },
    updateQueue: { memoCache: { data: [[update, create]] } },
    dependencies: { firstContext: { context, memoizedValue: { go: globalGo } } },
  };
  Object.assign(el, { __reactFiber$test: { return: root } });
  Object.assign(link, {
    __reactFiber$test: {
      dependencies: { firstContext: { context, memoizedValue: { go: localGo } } },
      return: root,
    },
  });
  el.scrollIntoView = vi.fn();
  return { el, link, root };
}
beforeEach(() => {
  calls.length = 0;
  globalGo.mockReset();
  localGo.mockReset();
  created.mockReset();
  Object.defineProperty(Element.prototype, 'checkVisibility', {
    configurable: true,
    value: function (this: Element) {
      return this.isConnected && !this.closest('[hidden]');
    },
  });
  vi.stubGlobal('require', () => context);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, 'checkVisibility');
});
it('uses the mounted native creation action without navigating the main page or creating DOM', () => {
  const { link } = fixture();
  const before = document.body.innerHTML;
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(true);
  expect(created).toHaveBeenCalledWith(
    expect.objectContaining({
      relativeURL: '/@bob/post/two',
      optimisticUpdater: { connectionRecord: 'connection', relayRecordID: 'request-id' },
    }),
  );
  expect(globalGo).not.toHaveBeenCalled();
  expect(localGo).not.toHaveBeenCalled();
  expect(document.body.innerHTML).toBe(before);
});
it('updates the same saved column and routes within it without adding a second column', () => {
  const { el } = fixture();
  const column = nativeColumns()[0];
  if (!column) throw new Error('Column missing');
  expect(updateNativeColumn(column, '/@bob/post/two')).toBe(true);
  expect(calls).toEqual([
    { columnID: '123', relayRecordID: 'relay-123', relativeURL: '/@bob/post/two' },
  ]);
  expect(localGo).toHaveBeenCalledWith('/@bob/post/two', { replace: true });
  expect(globalGo).not.toHaveBeenCalled();
  expect(document.querySelectorAll('[data-deck-column]')).toHaveLength(1);
  expect(el.style.cssText).toBe('');
  expect(document.querySelector('iframe')).toBeNull();
});
it('fails open when native capabilities are unavailable, rather than guessing a mutation', () => {
  const { link, root } = fixture();
  root.updateQueue.memoCache.data = [];
  const column = nativeColumns()[0];
  if (!column) throw new Error('Column missing');
  expect(updateNativeColumn(column, '/@bob/post/two')).toBe(false);
  vi.stubGlobal('require', undefined);
  expect(findDispatcher(link)).toBeNull();
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(false);
  expect(calls).toEqual([]);
  expect(globalGo).not.toHaveBeenCalled();
});
it('refuses hidden cached columns for both creation and reuse', () => {
  const { el, link } = fixture();
  const column = nativeColumns()[0];
  if (!column) throw new Error('Column missing');
  el.hidden = true;
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(false);
  expect(updateNativeColumn(column, '/@bob/post/two')).toBe(false);
  expect(created).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
  expect(localGo).not.toHaveBeenCalled();
});
it('does not treat a working global dispatcher as creation capability', () => {
  const { root, link } = fixture();
  root.updateQueue.memoCache.data = [[update]];
  expect(findDispatcher(link, true)).not.toBeNull();
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(false);
  expect(globalGo).not.toHaveBeenCalled();
});
it('refuses ambiguous native creation callbacks', () => {
  const { root, link } = fixture();
  root.updateQueue.memoCache.data.push([create.bind(null)]);
  // A second independent callback with the same signature must not be guessed.
  const duplicate = new Function('created', `return (${create.toString()})`)(created);
  root.updateQueue.memoCache.data.push([duplicate]);
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(false);
  expect(created).not.toHaveBeenCalled();
});
