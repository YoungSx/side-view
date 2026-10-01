import { afterEach, expect, it, vi } from 'vitest';
import { installXMainBack } from './main-back';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function setup(
  open = true,
  entries = [
    { key: 'home', index: 0 },
    { key: 'search', index: 1 },
  ],
) {
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><button data-testid="app-bar-back"><span>Back</span></button></div><button id="other">Other</button>';
  const close = vi.fn();
  const traverseTo = vi.fn(() => {
    expect(close).toHaveBeenCalledOnce();
    return { committed: Promise.resolve(), finished: Promise.resolve() };
  });
  vi.stubGlobal('navigation', { currentEntry: entries.at(-1), entries: () => entries, traverseTo });
  cleanup = installXMainBack(document, () => open, close);
  const click = (init: MouseEventInit = {}, selector = 'span') => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    document.querySelector(selector)?.dispatchEvent(event);
    return event;
  };
  return { close, traverseTo, click };
}

it('closes the reading and traverses to the main frame predecessor instead of calling joint history.back', () => {
  const { close, traverseTo, click } = setup();
  const native = vi.fn();
  document.querySelector('button')?.addEventListener('click', native);
  expect(click().defaultPrevented).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  expect(traverseTo).toHaveBeenCalledWith('home');
  expect(native).not.toHaveBeenCalled();
});

it('leaves closed readings, modified clicks and unrelated buttons alone', () => {
  const { close, click } = setup();
  for (const init of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    expect(click(init).defaultPrevented).toBe(false);
  }
  click({}, '#other');
  expect(close).not.toHaveBeenCalled();
  cleanup?.();
  const closed = setup(false);
  expect(closed.click().defaultPrevented).toBe(false);
  expect(closed.close).not.toHaveBeenCalled();
});

it('closes the iframe but preserves X fallback when there is no same-origin predecessor', () => {
  const { close, traverseTo, click } = setup(true, [{ key: 'direct-search', index: 0 }]);
  expect(click().defaultPrevented).toBe(false);
  expect(close).toHaveBeenCalledOnce();
  expect(traverseTo).not.toHaveBeenCalled();
});

it('preserves native fallback without the Navigation API and removes the listener on cleanup', () => {
  const { close, click } = setup();
  vi.stubGlobal('navigation', undefined);
  expect(click().defaultPrevented).toBe(false);
  expect(close).toHaveBeenCalledOnce();
  cleanup?.();
  click();
  expect(close).toHaveBeenCalledOnce();
});
