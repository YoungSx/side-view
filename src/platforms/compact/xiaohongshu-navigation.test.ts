import { afterEach, expect, it, vi } from 'vitest';
import { findXiaohongshuNavigation } from './xiaohongshu-navigation';

afterEach(() => {
  document.body.innerHTML = '';
});

function fixture(initial = false) {
  document.body.innerHTML = '<div id="app"><nav class="side-bar side-bar-ai"></nav></div>';
  let route: ((to: unknown, from: unknown, failure?: unknown) => void) | undefined;
  const remove = vi.fn(() => {
    route = undefined;
  });
  const store = {
    sideCollapse: initial,
    $patch: vi.fn((value: { sideCollapse: boolean }) => {
      store.sideCollapse = value.sideCollapse;
    }),
  };
  Object.assign(document.querySelector('#app') ?? {}, {
    __vue_app__: {
      config: {
        globalProperties: {
          $pinia: { _s: new Map([['global', store]]) },
          $router: {
            afterEach: (callback: typeof route) => {
              route = callback;
              return remove;
            },
          },
        },
      },
    },
  });
  const binding = findXiaohongshuNavigation(document);
  if (!binding) throw new Error('missing fixture binding');
  return {
    store,
    binding,
    remove,
    navigate: (native: boolean, failure?: unknown, name = 'Explore') => {
      store.sideCollapse = native;
      route?.({ name }, {}, failure);
      binding.refresh();
    },
  };
}

it('uses native collapse and restores a previously expanded navigation', () => {
  const { store, binding, remove } = fixture();
  binding.set(true);
  expect(store.sideCollapse).toBe(true);
  store.sideCollapse = false;
  binding.refresh();
  expect(store.sideCollapse).toBe(true);
  binding.set(false);
  expect(store.sideCollapse).toBe(false);
  expect(remove).toHaveBeenCalledOnce();
});

it('retains native collapse on routes which already require it', () => {
  const { store, binding, navigate } = fixture(false);
  binding.set(true);
  navigate(true);
  binding.set(false);
  expect(store.sideCollapse).toBe(true);
});

it('restores the latest native route choice instead of an old snapshot', () => {
  const { store, binding, navigate } = fixture(true);
  binding.set(true);
  navigate(false);
  expect(store.sideCollapse).toBe(true);
  binding.set(false);
  expect(store.sideCollapse).toBe(false);
});

it('does not replace restoration state after cancelled navigation', () => {
  const { store, binding, navigate } = fixture(false);
  binding.set(true);
  navigate(true, new Error('cancelled'));
  binding.set(false);
  expect(store.sideCollapse).toBe(false);
});

it('rejects older navigation and missing runtime capabilities', () => {
  fixture();
  document.querySelector('nav')?.classList.remove('side-bar-ai');
  expect(findXiaohongshuNavigation(document)).toBeNull();
  document.querySelector('nav')?.classList.add('side-bar-ai');
  Object.assign(document.querySelector('#app') ?? {}, { __vue_app__: {} });
  expect(findXiaohongshuNavigation(document)).toBeNull();
});

it.each(['AiChat', 'AiChatTab'])(
  'preserves restoration on %s whose native guard skips state changes',
  (name) => {
    const { store, binding, navigate } = fixture(false);
    binding.set(true);
    navigate(true, undefined, name);
    binding.set(false);
    expect(store.sideCollapse).toBe(false);
  },
);
