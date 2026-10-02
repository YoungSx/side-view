import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createNativeColumn,
  findDispatcher,
  nativeColumns,
  nativeContexts,
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
const resetCalls = vi.fn();
function reset(relativeURL: string) {
  resetCalls({ type: 'reset', url: relativeURL });
}

it('bridges nearest providers including the app router above deeply nested route trees', () => {
  const el = document.createElement('div');
  const context = { $$typeof: Symbol.for('react.context') };
  const routeContext = { $$typeof: Symbol.for('react.context') };
  let parent: Record<string, unknown> = {
    type: routeContext,
    memoizedProps: { value: 'route-store' },
  };
  parent = { type: context, memoizedProps: { value: 'outer' }, return: parent };
  for (let i = 0; i < 250; i++) parent = { return: parent };
  parent = { type: context, memoizedProps: { value: 'nearest' }, return: parent };
  Object.assign(el, { __reactFiber$test: { return: parent } });
  const values = nativeContexts(el);
  expect(values.get(context)).toBe('nearest');
  expect(values.get(routeContext)).toBe('route-store');
  expect(values.size).toBe(2);
});
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
      updateQueue: { memoCache: { data: [[reset]] } },
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
  resetCalls.mockReset();
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
  expect(resetCalls).toHaveBeenCalledWith({ type: 'reset', url: '/@bob/post/two' });
  expect(localGo).not.toHaveBeenCalled();
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

it('does not mutate a saved column if its native history reset callback is unavailable', () => {
  const { link, root } = fixture();
  Object.assign(link, { __reactFiber$test: { return: root } });
  const column = nativeColumns()[0];
  if (!column) throw new Error('Column missing');
  expect(updateNativeColumn(column, '/@bob/post/two')).toBe(false);
  expect(calls).toEqual([]);
  expect(globalGo).not.toHaveBeenCalled();
});

/** The standard fixture, but living inside our replica host. */
function replica() {
  document.body.innerHTML =
    '<div data-sideview-threads-panel><div data-deck-column>' +
    '<div data-column-scrollable><a href="/@alice/post/one">Post</a></div></div></div>';
  const deck = document.querySelector<HTMLElement>('[data-deck-column]');
  const link = deck?.querySelector('a');
  const scrollable = deck?.querySelector('[data-column-scrollable]');
  if (!deck || !link || !scrollable) throw new Error('Fixture missing');
  const root = {
    memoizedProps: { column$key: { id: '123', __id: 'relay-123', uri: '/@alice/post/one' } },
    updateQueue: { memoCache: { data: [[update, create]] } },
  };
  Object.assign(deck, { __reactFiber$test: { return: root } });
  deck.scrollIntoView = vi.fn();
  return { deck, link, scrollable, root };
}

it('never adopts, retargets or creates through a replica column', () => {
  const { deck, link, scrollable } = replica();
  expect(nativeColumns()).toEqual([]);
  expect(
    updateNativeColumn(
      { id: '123', relayId: 'relay-123', url: '/@alice/post/one', element: deck, update: null },
      '/@bob/post/two',
    ),
  ).toBe(false);
  expect(createNativeColumn(scrollable, '/@bob/post/two', 'request-id')).toBe(false);
  expect(createNativeColumn(link, '/@bob/post/two', 'request-id')).toBe(false);
  expect(created).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});

it('still owns every real column on a page that also hosts a replica', () => {
  const { deck } = replica();
  const real = document.createElement('div');
  real.setAttribute('data-deck-column', '');
  const realRoot = {
    memoizedProps: { column$key: { id: '9', __id: 'relay-9', uri: '/@c/post/three' } },
    updateQueue: { memoCache: { data: [[update]] } },
  };
  Object.assign(real, { __reactFiber$test: { return: realRoot } });
  real.scrollIntoView = vi.fn();
  document.body.append(real);

  const columns = nativeColumns();
  expect(columns).toHaveLength(1);
  expect(columns[0]?.id).toBe('9');
  expect(columns[0]?.element).toBe(real);
  expect(deck.isConnected).toBe(true);
});
