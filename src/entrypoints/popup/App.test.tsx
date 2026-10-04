import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { loadSettings, type SettingsSnapshot, settings } from '@/settings/storage';
import { App } from './App';

/** `vi.mock` is hoisted above the imports, so the fixture it closes over has to be hoisted too. */
const { defaults } = vi.hoisted(() => ({
  defaults: {
    enabled: true,
    layoutMode: 'replace-sidebar',
    columnWidth: 600,
    compactNavigation: false,
    interceptProfilesAndTags: true,
    selectorOverrides: {},
    uiLanguage: 'auto',
  } satisfies SettingsSnapshot,
}));

vi.mock('@/settings/storage', () => ({
  loadSettings: vi.fn(async () => ({ ...defaults })),
  settings: Object.fromEntries(
    Object.keys(defaults).map((key) => [key, { setValue: vi.fn(async () => {}) }]),
  ),
}));

/** Point the fake tabs API at a URL, and at a content script that does (or does not) answer. */
function stubTab(options: { url?: string; answer?: unknown; reject?: boolean }): void {
  fakeBrowser.tabs.query = vi.fn(async () => [
    { id: 1, active: true, url: options.url ?? 'https://x.com/home' },
  ]) as unknown as typeof fakeBrowser.tabs.query;
  fakeBrowser.tabs.sendMessage = (options.reject
    ? vi.fn(async () => {
        throw new Error('Receiving end does not exist');
      })
    : vi.fn(async () => options.answer)) as unknown as typeof fakeBrowser.tabs.sendMessage;
  fakeBrowser.tabs.reload = vi.fn(async () => {}) as unknown as typeof fakeBrowser.tabs.reload;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSettings).mockResolvedValue({ ...defaults });
});
afterEach(cleanup);

it('reports the active platform from the ping', async () => {
  stubTab({ answer: { kind: 'ready', platform: 'x', columnOpen: true } });
  render(<App />);
  expect(await screen.findByText('X · Active')).toBeDefined();
  expect(
    screen.getByRole('switch', { name: 'Enable Side View' }).getAttribute('aria-checked'),
  ).toBe('true');
});

it('offers a reload when a supported page has no content script yet', async () => {
  stubTab({ url: 'https://x.com/home', reject: true });
  render(<App />);
  await screen.findByText('X · Reload');
  expect(screen.getByText('This tab loaded before Side View started.')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Reload tab' }));
  await waitFor(() => expect(fakeBrowser.tabs.reload).toHaveBeenCalledWith(1));
});

it('does not offer a reload on a site the extension does not handle', async () => {
  stubTab({ url: 'https://example.com/', reject: true });
  render(<App />);
  await screen.findByText('Not here');
  expect(screen.queryByRole('button', { name: 'Reload tab' })).toBeNull();
});

it('re-derives the status when the extension is switched on', async () => {
  // No listener on a supported host: with the extension off that is just "off", not a stale tab.
  stubTab({ url: 'https://x.com/home', reject: true });
  vi.mocked(loadSettings).mockResolvedValue({ ...defaults, enabled: false });
  render(<App />);
  const toggle = await screen.findByRole('switch', { name: 'Enable Side View' });
  expect(screen.getByText('X · Off')).toBeDefined();
  fireEvent.click(toggle);
  await screen.findByText('X · Reload');
  expect(settings.enabled.setValue).toHaveBeenLastCalledWith(true);
});

it('hides width, placement and compact navigation on Threads', async () => {
  stubTab({ answer: { kind: 'ready', platform: 'threads', columnOpen: false } });
  render(<App />);
  await screen.findByText('Threads · Active');
  expect(screen.getByText(/Threads uses native columns/)).toBeDefined();
  expect(screen.queryByRole('slider')).toBeNull();
  expect(screen.queryByRole('switch', { name: 'Compact navigation' })).toBeNull();
});

it('shows only supported settings on Xiaohongshu, including before reload', async () => {
  stubTab({ url: 'https://www.xiaohongshu.com/explore', reject: true });
  render(<App />);
  await screen.findByText('Xiaohongshu · Reload');
  expect(screen.getByRole('slider', { name: 'Detail width' })).toBeDefined();
  expect(screen.queryByRole('group', { name: 'Where detail opens' })).toBeNull();
  expect(screen.queryByRole('switch', { name: 'Compact navigation' })).toBeNull();
  expect(screen.queryByRole('switch', { name: 'Open profiles, hashtags and search' })).toBeNull();
  expect(screen.getByRole('switch', { name: 'Open user profiles' })).toBeDefined();
});

it('shows width and placement on X, and writes them straight through', async () => {
  stubTab({ answer: { kind: 'ready', platform: 'x', columnOpen: false } });
  render(<App />);
  await screen.findByText('X · Active');
  expect(screen.getByRole('switch', { name: 'Compact navigation' })).toBeDefined();
  const slider = screen.getByRole('slider', { name: 'Detail width' });
  // A popup has no Apply affordance worth the extra click, so the write happens on commit.
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  await waitFor(() =>
    expect(settings.columnWidth.setValue).toHaveBeenCalledWith(expect.any(Number)),
  );
  expect(screen.getByText(/px$/)).toBeDefined();
});

it('reports a failed write instead of silently reverting', async () => {
  stubTab({ answer: { kind: 'ready', platform: 'x', columnOpen: false } });
  render(<App />);
  await screen.findByText('X · Active');
  vi.mocked(settings.enabled.setValue).mockRejectedValueOnce(new Error('storage unavailable'));
  fireEvent.click(screen.getByRole('switch', { name: 'Enable Side View' }));
  await screen.findByText('Couldn’t save this change. Please try again.');
});

it('hides compact navigation when the native bridge reports it unavailable', async () => {
  stubTab({
    answer: {
      kind: 'ready',
      platform: 'bluesky',
      columnOpen: false,
      compactNavigationAvailable: false,
    },
  });
  render(<App />);
  await screen.findByText('Bluesky · Active');
  expect(screen.queryByRole('switch', { name: 'Compact navigation' })).toBeNull();
});

it('hides compact navigation on Threads even before its content script starts', async () => {
  stubTab({ url: 'https://www.threads.com/', reject: true });
  render(<App />);
  await screen.findByText('Threads · Reload');
  expect(screen.queryByRole('switch', { name: 'Compact navigation' })).toBeNull();
});
