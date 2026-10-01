import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installNativeNavigation } from './native-controller';
import { findBlueskyNavigation, findXNavigation, type NativeNavigation } from './native-runtime';
import { COMPACT_REQUEST, COMPACT_STATUS } from './protocol';

let dispose: (() => void) | undefined;
beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(COMPACT_REQUEST);
  document.documentElement.removeAttribute(COMPACT_STATUS);
  vi.useFakeTimers();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) =>
    window.setTimeout(() => fn(0), 1),
  );
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.documentElement.removeAttribute(COMPACT_REQUEST);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function settle() {
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(20);
}
function xFixture(initialCount = 0) {
  const element = document.createElement('header');
  element.setAttribute('role', 'banner');
  document.body.append(element);
  const state = { sideNavCollapseCount: initialCount, isSideNavForceCollaposed: initialCount > 0 };
  const toggle = vi.fn((enabled: boolean) => {
    state.sideNavCollapseCount += enabled ? 1 : -1;
  });
  Object.assign(element, {
    __reactFiber$test: {
      stateNode: { state, _getLayoutContextValue: () => ({ setSideNavForceCollapased: toggle }) },
    },
  });
  return { element, state, toggle };
}
function blueskyFixture(ambiguous = false) {
  document.body.innerHTML =
    '<main></main><nav role="navigation"><a href="/notifications"></a></nav>';
  const element = document.querySelector('nav');
  if (!element) throw new Error('missing nav fixture');
  const media = {
    media: '(max-width: 1300px)',
    matches: false,
    addListener() {},
    removeListener() {},
    dispose() {},
  };
  const dispatch = vi.fn();
  const hooks = [
    { memoizedState: { media: '(min-width: 1100px)' } },
    { memoizedState: { media: '(min-width: 1100px) and (max-width: 1300px)' } },
    { memoizedState: media },
    // Deliberately not the live site's current hook index.
    { memoizedState: { current: null } },
    { memoizedState: false, queue: { dispatch } },
    { memoizedState: { deps: [media] } },
    ...(ambiguous
      ? [
          { memoizedState: false, queue: { dispatch: vi.fn() } },
          { memoizedState: { deps: [media] } },
        ]
      : []),
  ];
  for (let i = 0; i < hooks.length - 1; i++) Object.assign(hooks[i] ?? {}, { next: hooks[i + 1] });
  Object.assign(element, {
    __reactFiber$test: { memoizedProps: { routeName: 'Home' }, memoizedState: hooks[0] },
  });
  return { element, dispatch };
}

it('balances X ownership across repeated updates without releasing another native consumer', async () => {
  const { state, toggle } = xFixture(2);
  document.documentElement.setAttribute(COMPACT_REQUEST, 'true');
  dispose = installNativeNavigation(() => findXNavigation(document));
  for (let i = 0; i < 3; i++) {
    window.dispatchEvent(new Event('resize'));
    await settle();
  }
  expect(state.sideNavCollapseCount).toBe(3);
  expect(toggle).toHaveBeenCalledTimes(1);
  document.documentElement.setAttribute(COMPACT_REQUEST, 'false');
  await settle();
  expect(state.sideNavCollapseCount).toBe(2);
  dispose();
  expect(state.sideNavCollapseCount).toBe(2);
});

it('releases an old X layout and acquires a newly mounted one', async () => {
  const first = xFixture();
  document.documentElement.setAttribute(COMPACT_REQUEST, 'true');
  dispose = installNativeNavigation(() => findXNavigation(document));
  first.element.remove();
  const second = xFixture();
  await settle();
  expect(first.state.sideNavCollapseCount).toBe(0);
  expect(second.state.sideNavCollapseCount).toBe(1);
});

it('restores the current Bluesky breakpoint rather than the activation snapshot', () => {
  const { dispatch } = blueskyFixture();
  const match = vi.spyOn(window, 'matchMedia');
  const binding = findBlueskyNavigation(document);
  if (!binding) throw new Error('missing native binding');
  binding.set(true);
  expect(dispatch).toHaveBeenLastCalledWith(true);
  match.mockReturnValue({ matches: true } as MediaQueryList);
  binding.set(false);
  expect(dispatch).toHaveBeenLastCalledWith(true);
  match.mockReturnValue({ matches: false } as MediaQueryList);
  binding.set(false);
  expect(dispatch).toHaveBeenLastCalledWith(false);
});

it('rejects ambiguous Bluesky state instead of guessing a hook index', () => {
  const { dispatch } = blueskyFixture(true);
  expect(findBlueskyNavigation(document)).toBeNull();
  expect(dispatch).not.toHaveBeenCalled();
});

it('reapplies only the owned navigation state after resize or a native rerender', async () => {
  const { element, dispatch } = blueskyFixture();
  document.documentElement.setAttribute(COMPACT_REQUEST, 'true');
  dispose = installNativeNavigation(() => findBlueskyNavigation(document));
  dispatch.mockClear();
  window.dispatchEvent(new Event('resize'));
  await settle();
  expect(dispatch).toHaveBeenLastCalledWith(true);
  dispatch.mockClear();
  element.append(document.createElement('span'));
  await settle();
  expect(dispatch).toHaveBeenLastCalledWith(true);
  // Timeline updates do not cause a traversal/dispatch in the nav.
  dispatch.mockClear();
  document.querySelector('main')?.append(document.createElement('article'));
  await settle();
  expect(dispatch).not.toHaveBeenCalled();
});

it('releases on invalidation and stops responding to later mutations', async () => {
  const { state } = xFixture();
  document.documentElement.setAttribute(COMPACT_REQUEST, 'true');
  dispose = installNativeNavigation(() => findXNavigation(document));
  dispose();
  dispose = undefined;
  window.dispatchEvent(new Event('resize'));
  await settle();
  expect(state.sideNavCollapseCount).toBe(0);
  expect(document.documentElement.hasAttribute(COMPACT_STATUS)).toBe(false);
});

it('fails closed when capability disappears, with no CSS fallback', async () => {
  const { state } = xFixture();
  let binding: NativeNavigation | null = findXNavigation(document);
  document.documentElement.setAttribute(COMPACT_REQUEST, 'true');
  dispose = installNativeNavigation(() => binding);
  binding = null;
  window.dispatchEvent(new Event('resize'));
  await settle();
  expect(state.sideNavCollapseCount).toBe(0);
  expect(document.documentElement.getAttribute(COMPACT_STATUS)).toBe('unavailable');
  expect(document.querySelector('style')).toBeNull();
});
