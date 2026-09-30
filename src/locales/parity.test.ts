import { expect, it } from 'vitest';
import en from './en.json';
import ja from './ja.json';
import zhCN from './zh_CN.json';
import zhTW from './zh_TW.json';

function keys(node: unknown, prefix: string, out: Set<string>): void {
  if (typeof node === 'string') {
    out.add(prefix);
    return;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.message === 'string' && prefix) {
      out.add(prefix);
      return;
    }
    for (const [key, value] of Object.entries(record))
      keys(value, prefix ? `${prefix}.${key}` : key, out);
  }
}

function keySet(locale: unknown): Set<string> {
  const out = new Set<string>();
  keys(locale, '', out);
  return out;
}

for (const [name, locale] of [
  ['zh_CN', zhCN],
  ['zh_TW', zhTW],
  ['ja', ja],
] as const) {
  it(`${name} has exactly the same keys as en`, () => {
    const expected = keySet(en);
    const actual = keySet(locale);
    const missing = [...expected].filter((key) => !actual.has(key));
    const extra = [...actual].filter((key) => !expected.has(key));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
}
