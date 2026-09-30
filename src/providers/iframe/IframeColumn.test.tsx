import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { IframeColumn } from './IframeColumn';

const url = 'https://x.com/jack/status/123';
const props = {
  intent: { kind: 'status' as const, url },
  frameUrl: `${url}?lang=en`,
  frameName: 'sideview-detail',
  onClose: vi.fn(),
  findHeader: () => null,
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it.each(['poll', 'load'] as const)(
  'keeps the previous tweet hidden when a stale %s arrives during navigation',
  (signal) => {
    vi.useFakeTimers();
    const view = render(<IframeColumn {...props} />);
    const frame = screen.getByTitle('side-view detail') as HTMLIFrameElement;
    const previous = { URL: props.frameUrl, readyState: 'complete', documentElement: null };
    Object.defineProperty(frame, 'contentDocument', { configurable: true, value: previous });
    fireEvent.load(frame);
    expect(frame.style.visibility).toBe('visible');

    const next = 'https://x.com/beth/status/456';
    view.rerender(
      <IframeColumn {...props} intent={{ kind: 'status', url: next }} frameUrl={next} />,
    );
    expect(frame.style.visibility).toBe('hidden');
    // Browsers retain the old document until the new navigation commits.
    if (signal === 'poll') act(() => vi.advanceTimersByTime(500));
    else fireEvent.load(frame);
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(frame.style.visibility).toBe('hidden');

    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: { URL: next, readyState: 'interactive', documentElement: null },
    });
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('status')).toBeNull();
    expect(frame.style.visibility).toBe('visible');
    expect(view.container.querySelector('.sv-header-unavailable')).toBeNull();
    fireEvent.load(frame);
    expect(view.container.querySelector('.sv-header-unavailable')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open in a new tab' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  },
);

it('waits for the native header after load without showing floating recovery controls', async () => {
  render(<IframeColumn {...props} findHeader={(doc) => doc.getElementById('header')} />);
  const frame = screen.getByTitle('side-view detail') as HTMLIFrameElement;
  const doc = document.implementation.createHTMLDocument();
  Object.defineProperty(doc, 'URL', { value: props.frameUrl });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: doc });
  doc.body.innerHTML = '<div role="status">Loading post…</div>';
  fireEvent.load(frame);
  expect(frame.style.visibility).toBe('visible');
  expect(screen.queryByRole('link', { name: 'Open in a new tab' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  expect(doc.querySelector('[data-sv-detail-actions]')).toBeNull();

  doc.body.innerHTML = '<header id="header">Post</header>';
  await vi.waitFor(() =>
    expect(doc.querySelectorAll('#header [data-sv-detail-actions]')).toHaveLength(1),
  );
  expect(doc.querySelector('a')?.href).toBe(url);
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
});

it('ignores the initial blank load and exposes a bounded failure with a canonical fallback link', () => {
  vi.useFakeTimers();
  render(<IframeColumn {...props} />);
  const frame = screen.getByTitle('side-view detail');
  Object.defineProperty(frame, 'contentDocument', {
    configurable: true,
    value: { URL: 'about:blank' },
  });
  fireEvent.load(frame);
  expect(screen.getByRole('status').textContent).toContain('Loading…');
  act(() => vi.advanceTimersByTime(20000));
  expect(screen.getByRole('alert').textContent).toContain('Couldn’t load');
  expect(
    screen
      .getAllByRole('link', { name: 'Open in a new tab' })
      .every((link) => link.getAttribute('href') === url),
  ).toBe(true);
});

it('detects blocked documents, then clears the error when switching to a valid detail', () => {
  const view = render(<IframeColumn {...props} />);
  const frame = screen.getByTitle('side-view detail');
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: null });
  fireEvent.load(frame);
  expect(screen.getByRole('alert')).toBeDefined();
  const next = 'https://x.com/beth/status/456';
  view.rerender(<IframeColumn {...props} intent={{ kind: 'status', url: next }} frameUrl={next} />);
  expect(screen.queryByRole('alert')).toBeNull();
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: { URL: next } });
  fireEvent.load(frame);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('reveals the platform view as soon as its document is interactive, before the full load event', () => {
  vi.useFakeTimers();
  render(<IframeColumn {...props} />);
  const frame = screen.getByTitle('side-view detail') as HTMLIFrameElement;
  Object.defineProperty(frame, 'contentDocument', {
    configurable: true,
    value: { URL: props.frameUrl, readyState: 'interactive', documentElement: null },
  });
  // No load event fired yet — the interactive-document poll should promote to ready on its own.
  act(() => vi.advanceTimersByTime(150));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(frame.style.visibility).toBe('visible');
});
