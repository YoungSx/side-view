import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setUiLanguage } from '@/i18n/runtime';
import { settings } from '@/settings/storage';
import { App } from './App';

vi.mock('@/settings/storage', () => {
  const defaults = {
    enabled: true,
    layoutMode: 'replace-sidebar',
    columnWidth: 600,
    compactNavigation: false,
    interceptProfilesAndTags: true,
    selectorOverrides: {},
    uiLanguage: 'auto',
  };
  return {
    loadSettings: vi.fn(async () => defaults),
    settings: Object.fromEntries(
      Object.keys(defaults).map((key) => [key, { setValue: vi.fn(async () => {}) }]),
    ),
  };
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('opens a page with labelled sections and saves a switch only after storage succeeds', async () => {
  render(<App />);
  const toggle = await screen.findByRole('switch', { name: 'Enable side-view' });
  vi.mocked(settings.enabled.setValue).mockRejectedValueOnce(new Error('storage unavailable'));
  fireEvent.click(toggle);
  await screen.findByText('Couldn’t save this change. Please try again.');
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle);
  await screen.findByText('Changes saved');
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(settings.enabled.setValue).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps width edits local until applied and validates selector overrides', async () => {
  render(<App />);
  const width = await screen.findByRole('spinbutton', { name: 'Maximum detail width' });
  fireEvent.change(width, { target: { value: '800' } });
  expect(settings.columnWidth.setValue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(settings.columnWidth.setValue).toHaveBeenCalledWith(800));
  await screen.findByText('Changes saved');
  fireEvent.click(screen.getByText('Selector overrides'));
  const input = screen.getByLabelText('Custom selectors');
  fireEvent.change(input, { target: { value: '{"timeline":"["}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save selectors' }));
  expect(screen.getByText('“timeline” is not a valid CSS selector.')).toBeDefined();
  expect(settings.selectorOverrides.setValue).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '{"timeline":"main"}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save selectors' }));
  await waitFor(() =>
    expect(settings.selectorOverrides.setValue).toHaveBeenCalledWith({ timeline: 'main' }),
  );
});

it('switches the interface language and persists the choice', async () => {
  render(<App />);
  await screen.findByRole('switch', { name: 'Enable side-view' });
  fireEvent.click(screen.getByLabelText('简体中文'));
  await screen.findByText('更改已保存');
  expect(settings.uiLanguage.setValue).toHaveBeenCalledWith('zh_CN');
  // The page must actually re-render in the new language, not merely persist the choice.
  await screen.findByRole('heading', { name: '设置', level: 1 });
  await setUiLanguage('auto');
});
