import { act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentScriptContext } from '#imports';
import { settings } from '@/settings/storage';
import { byId, X_TIMELINE_HTML } from '@/test-utils/dom';
import { startSideView } from './engine';

let ctx: ContentScriptContext;
const host = () => document.querySelector<HTMLElement>('[data-sideview-host]');
const click = (id: string, init: MouseEventInit = {}) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  act(() => byId(id).dispatchEvent(event));
  return event;
};
beforeEach(async () => {
  document.body.innerHTML = X_TIMELINE_HTML;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1400);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    right: 600,
    width: 600,
  } as DOMRect);
  await settings.enabled.setValue(true);
  await settings.compactNavigation.setValue(false);
  ctx = new ContentScriptContext('engine-test');
  await act(async () => {
    await startSideView(ctx);
  });
});
afterEach(() => {
  act(() => ctx.abort());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('has no empty view at startup and follows open, switch, close, reopen with real components', () => {
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
  expect(click('body', { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(host()).toBeNull();
  expect(click('body').defaultPrevented).toBe(true);
  const firstHost = host();
  const frame = firstHost?.shadowRoot?.querySelector('iframe');
  expect(frame?.src).toContain('/jack/status/123?lang=');
  expect(firstHost?.shadowRoot?.textContent).not.toContain('Click a tweet');
  click('quote-body');
  expect(host()).toBe(firstHost);
  expect(host()?.shadowRoot?.querySelector('iframe')).toBe(frame);
  expect(frame?.src).toContain('/beth/status/456?lang=');
  act(() => host()?.shadowRoot?.querySelector<HTMLButtonElement>('button[title="Close"]')?.click());
  expect(host()).toBeNull();
  expect(frame?.isConnected).toBe(false);
  expect(document.getElementById('sv-layout-style')).toBeNull();
  expect(document.body.classList.contains('sv-active')).toBe(false);
  expect(click('quote-body').defaultPrevented).toBe(true);
  expect(host()?.shadowRoot?.querySelector('iframe')?.src).toContain('/beth/status/456?lang=');
});

it('does not swallow a click or leave layout mutations when opening is unavailable', () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  expect(click('body').defaultPrevented).toBe(false);
  expect(host()).toBeNull();
  expect(document.getElementById('sv-layout-style')).toBeNull();
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  expect(click('body').defaultPrevented).toBe(true);
  expect(host()?.shadowRoot?.querySelector('iframe')?.src).toContain('/jack/status/123?lang=');
});

it('does not install UI or navigation preferences after startup is invalidated', async () => {
  act(() => ctx.abort());
  await settings.compactNavigation.setValue(true);
  ctx = new ContentScriptContext('cancelled-engine-test');
  await act(async () => {
    const starting = startSideView(ctx);
    ctx.abort();
    await starting;
  });
  expect(host()).toBeNull();
  expect(document.getElementById('sv-navigation-style')).toBeNull();
  expect(document.body.classList.contains('sv-compact-nav')).toBe(false);
  await settings.compactNavigation.setValue(false);
});
