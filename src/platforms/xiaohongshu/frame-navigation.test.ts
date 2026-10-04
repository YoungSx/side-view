import { afterEach, expect, it, vi } from 'vitest';
import { installFrameNavigation } from './frame-navigation';

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
});

it('keeps default new-tab author links in the reading but preserves modifier gestures and detail actions', () => {
  const doc = document.implementation.createHTMLDocument();
  Object.defineProperty(doc, 'URL', {
    value: 'https://www.xiaohongshu.com/explore/0123456789abcdef01234567',
  });
  Object.defineProperty(doc, 'defaultView', {
    value: { location: new URL(doc.URL), getSelection: () => null },
  });
  doc.body.innerHTML =
    '<a id="author" target="_blank" href="https://www.xiaohongshu.com/user/profile/abcdef0123456789abcdef01?xsec_token=signed">Author</a><div data-sv-detail-actions><a id="open" target="_blank" href="https://www.xiaohongshu.com/user/profile/abcdef0123456789abcdef01">Open</a></div>';
  const navigate = vi.fn();
  dispose = installFrameNavigation(doc, navigate);
  const click = (id: string, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    doc.getElementById(id)?.dispatchEvent(event);
    return event;
  };
  expect(click('author').defaultPrevented).toBe(true);
  expect(navigate).toHaveBeenCalledWith(
    'https://www.xiaohongshu.com/user/profile/abcdef0123456789abcdef01?xsec_token=signed',
  );
  for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }])
    expect(click('author', init).defaultPrevented).toBe(false);
  expect(click('open').defaultPrevented).toBe(false);
  expect(navigate).toHaveBeenCalledTimes(1);
  dispose();
  dispose = undefined;
  expect(click('author').defaultPrevented).toBe(false);
});
