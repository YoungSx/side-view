import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentScriptContext } from '#imports';
import { XAdapter } from '@/platforms/x/adapter';
import { byId, X_TIMELINE_HTML } from '@/test-utils/dom';
import { ClickRouter, type InterceptPolicy } from './click-router';

const cleanups: Array<() => void> = [];

function install(policy: InterceptPolicy) {
  const onIntent = vi.fn(() => true);
  const router = new ClickRouter(new XAdapter(), onIntent, policy);
  router.install({
    onInvalidated: (cb: () => void) => cleanups.push(cb),
  } as unknown as ContentScriptContext);
  return onIntent;
}

function click(id: string, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  byId(id).dispatchEvent(event);
  return event;
}

describe('ClickRouter', () => {
  beforeEach(() => {
    document.body.innerHTML = X_TIMELINE_HTML;
  });
  afterEach(() => {
    for (const teardown of cleanups.splice(0)) teardown();
  });

  it('intercepts a tweet-body click and cancels native navigation', () => {
    const onIntent = install(() => true);
    const event = click('body');
    expect(onIntent).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets a profile click through when the policy excludes non-status kinds', () => {
    const onIntent = install((kind) => kind === 'status');
    const event = click('name');
    expect(onIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('intercepts a profile click when the policy allows it', () => {
    const onIntent = install(() => true);
    const event = click('name');
    expect(onIntent).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores modified clicks (open-in-new-tab etc.)', () => {
    const onIntent = install(() => true);
    const event = click('body', { metaKey: true });
    expect(onIntent).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

it('only prepares the side column for eligible, unmodified tweet clicks', () => {
  document.body.innerHTML = X_TIMELINE_HTML;
  const prepare = vi.fn(() => true);
  const onIntent = vi.fn(() => true);
  const router = new ClickRouter(new XAdapter(), onIntent, (kind) => kind === 'status', prepare);
  router.install({
    onInvalidated: (cb: () => void) => cleanups.push(cb),
  } as unknown as ContentScriptContext);
  click('name');
  click('body', { ctrlKey: true });
  expect(prepare).not.toHaveBeenCalled();
  click('body');
  expect(prepare).toHaveBeenCalledOnce();
  expect(onIntent).toHaveBeenCalledOnce();
  for (const teardown of cleanups.splice(0)) teardown();
});
