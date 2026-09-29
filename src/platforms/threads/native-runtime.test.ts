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
function fixture() {
  document.body.innerHTML = '<div data-deck-column><a href="/@alice/post/one">Post</a></div>';
  const el = document.querySelector<HTMLElement>('[data-deck-column]');
  const link = el?.querySelector('a');
  if (!el || !link) throw new Error('Fixture missing');
  const root = {
    memoizedProps: { column$key: { id: '123', __id: 'relay-123', uri: '/@alice/post/one' } },
    updateQueue: { memoCache: { data: [[update]] } },
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
  vi.stubGlobal('require', () => context);
});
afterEach(() => vi.unstubAllGlobals());
it('uses the native global router and native create passthrough, without creating DOM', () => {
  const { link } = fixture();
  const before = document.body.innerHTML;
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(true);
  expect(globalGo).toHaveBeenCalledWith('/', {
    passthroughProps: { newColumnID: 'request-id', newColumnURL: '/@bob/post/two' },
  });
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
