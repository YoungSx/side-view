import { describe, expect, it } from 'vitest';
import { resolveSelectors, X_DEFAULT_SELECTORS } from './selectors';

describe('resolveSelectors', () => {
  it('returns the defaults when there are no overrides', () => {
    expect(resolveSelectors()).toEqual(X_DEFAULT_SELECTORS);
  });

  it('applies a valid override for a known key', () => {
    expect(resolveSelectors({ primaryColumn: '#custom' }).primaryColumn).toBe('#custom');
  });

  it('ignores blank values and unknown keys', () => {
    const merged = resolveSelectors({ primaryColumn: '   ', bogus: '.nope' } as Record<
      string,
      string
    >);
    expect(merged.primaryColumn).toBe(X_DEFAULT_SELECTORS.primaryColumn);
    expect(merged).not.toHaveProperty('bogus');
  });
});
