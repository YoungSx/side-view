import { act } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { XAdapter } from '@/platforms/x/adapter';
import { IframeColumnProvider } from './iframe-provider';

let provider: IframeColumnProvider;
afterEach(() => {
  act(() => provider?.destroy());
  document.body.replaceChildren();
});
it('starts a fresh frame even when the main page selects the same original post again', () => {
  const container = document.createElement('div');
  document.body.append(container);
  provider = new IframeColumnProvider(new XAdapter(), () => {});
  const intent = { kind: 'status' as const, url: 'https://x.com/a/status/1' };
  act(() => {
    provider.mount(container);
    provider.open(intent);
  });
  const first = container.querySelector('iframe');
  expect(first).not.toBeNull();
  // Model native navigation within the existing reading context.
  first?.setAttribute('data-test-internal-route', '/b');
  act(() => provider.open(intent));
  const second = container.querySelector('iframe');
  expect(second).not.toBe(first);
  expect(first?.isConnected).toBe(false);
  expect(second?.src).toContain('/a/status/1');
  act(() => provider.refreshLabels());
  expect(container.querySelector('iframe')).toBe(second);
  act(() => provider.open({ kind: 'status', url: 'https://x.com/c/status/3' }));
  expect(container.querySelector('iframe')).not.toBe(second);
});
