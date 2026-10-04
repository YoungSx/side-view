import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  type FeedLayoutStore,
  findFeedLayout,
  fitFeedColumns,
  installFeedLayout,
} from './native-layout';
import { XHS_LAYOUT_STATUS } from './protocol';

let dispose: (() => void) | undefined;
let native: FeedLayoutStore;
let notify: () => void;
let width: number;

beforeEach(() => {
  document.body.innerHTML =
    '<div id="app"><div class="feeds-container"><section class="note-item"></section></div></div>';
  vi.stubGlobal('innerWidth', 1994);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  width = 1166;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return { left: this.id === 'app' ? 0 : 196, right: 196 + width, width } as DOMRect;
  });
  notify = () => {};
  native = {
    columns: 5,
    columnWidth: 274.4,
    gap: { horizontal: 32 },
    $patch: vi.fn((value) => {
      Object.assign(native, value);
      notify();
    }),
    $subscribe: vi.fn((callback) => {
      notify = callback;
      return () => {
        notify = () => {};
      };
    }),
    resize: vi.fn(() => {
      native.columns = 5;
      native.columnWidth = 274.4;
      notify();
    }),
  };
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.className = '';
  document.documentElement.removeAttribute(XHS_LAYOUT_STATUS);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('fits every column in the available width instead of concealing the fifth column', () => {
  for (const available of [297, 600, 733, 1166, 1500]) {
    const fitted = fitFeedColumns(available, 5, 32);
    expect(fitted.columns * fitted.columnWidth + (fitted.columns - 1) * 32).toBeCloseTo(available);
    expect(fitted.columnWidth).toBeGreaterThanOrEqual(142);
  }
  expect(fitFeedColumns(1166, 5, 32)).toEqual({ columns: 5, columnWidth: 207.6 });
});

it('does not change the site before opening, reflows live width changes, and restores on close', async () => {
  dispose = installFeedLayout(() => native);
  expect(native.$patch).not.toHaveBeenCalled();
  expect(document.documentElement.getAttribute(XHS_LAYOUT_STATUS)).toBe('available');
  document.body.classList.add('sv-active');
  await vi.waitFor(() => expect(native.columnWidth).toBe(207.6));
  width = 600;
  window.dispatchEvent(new Event('resize'));
  await vi.waitFor(() => expect(native.columns).toBe(3));
  width = 1166;
  window.dispatchEvent(new Event('resize'));
  await vi.waitFor(() => expect(native.columns).toBe(5));
  document.body.classList.remove('sv-active');
  await vi.waitFor(() => expect(native.columnWidth).toBe(274.4));
  expect(native.resize).toHaveBeenCalledOnce();
});

it('reconciles native resize updates and releases below the breakpoint and on cleanup', async () => {
  document.body.classList.add('sv-active');
  dispose = installFeedLayout(() => native);
  native.columnWidth = 300;
  notify();
  await vi.waitFor(() => expect(native.columnWidth).toBe(207.6));
  vi.stubGlobal('innerWidth', 1000);
  window.dispatchEvent(new Event('resize'));
  await vi.waitFor(() => expect(native.resize).toHaveBeenCalledOnce());
  vi.stubGlobal('innerWidth', 1994);
  window.dispatchEvent(new Event('resize'));
  await vi.waitFor(() => expect(native.columnWidth).toBe(207.6));
  dispose();
  dispose = undefined;
  expect(native.columnWidth).toBe(274.4);
  expect(document.documentElement.hasAttribute(XHS_LAYOUT_STATUS)).toBe(false);
});

it('validates the site capability and leaves unsupported versions untouched', () => {
  expect(findFeedLayout(document)).toBeNull();
  const app = document.querySelector('#app');
  Object.defineProperty(app, '__vue_app__', {
    value: { config: { globalProperties: { $pinia: { _s: new Map([['layout', native]]) } } } },
  });
  expect(findFeedLayout(document)).toBe(native);
  native.columnWidth = Number.NaN;
  expect(findFeedLayout(document)).toBeNull();
  document.body.classList.add('sv-active');
  dispose = installFeedLayout(() => null);
  expect(native.$patch).not.toHaveBeenCalled();
  expect(document.documentElement.getAttribute(XHS_LAYOUT_STATUS)).toBe('unavailable');
});

it.each([false, true])(
  'keeps reflowing after app replacement (initially absent: %s)',
  async (absent) => {
    const watched = new Set<Element>();
    let resizeObserved: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeObserved = callback;
        }
        observe(element: Element) {
          watched.add(element);
        }
        unobserve(element: Element) {
          watched.delete(element);
        }
        disconnect() {
          watched.clear();
        }
      },
    );
    const previousApp = document.querySelector('#app');
    if (absent) previousApp?.remove();
    document.body.classList.add('sv-active');
    dispose = installFeedLayout(() => native);
    const replacement = document.createElement('div');
    replacement.id = 'app';
    replacement.innerHTML =
      '<div class="feeds-container"><section class="note-item"></section></div>';
    previousApp?.remove();
    document.body.append(replacement);
    await vi.waitFor(() => expect(watched.has(replacement)).toBe(true));
    expect(watched.has(previousApp as Element)).toBe(false);
    await vi.waitFor(() => expect(native.columnWidth).toBe(207.6));
    width = 600;
    // A CSS-only width change has no body mutation or window resize event.
    resizeObserved();
    await vi.waitFor(() => expect(native.columns).toBe(3));
    expect(native.columnWidth).toBeCloseTo((600 - 64) / 3);
    dispose();
    dispose = undefined;
    expect(watched.size).toBe(0);
  },
);
