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
