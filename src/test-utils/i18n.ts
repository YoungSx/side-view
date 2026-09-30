import { fakeBrowser } from 'wxt/testing/fake-browser';
import en from '../locales/en.json';

/**
 * Teach fakeBrowser's `i18n.getMessage` the real English strings so component tests
 * keep asserting the exact copy users see. Flattens `en.json` the way the build does
 * (nested dots become underscores) and applies Chrome's `$1`–`$9` substitution.
 */
const flat = new Map<string, string>();

function flatten(node: unknown, prefix: string): void {
  if (typeof node === 'string') {
    flat.set(prefix, node);
    return;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.message === 'string' && prefix) {
      flat.set(prefix, record.message as string);
      return;
    }
    for (const [key, value] of Object.entries(record))
      flatten(value, prefix ? `${prefix}_${key}` : key);
  }
}
flatten(en, '');

function substitute(message: string, subs: string[]): string {
  return message.replace(/\$(\$|[1-9])/g, (match, token: string) =>
    token === '$' ? '$' : (subs[Number(token) - 1] ?? match),
  );
}

fakeBrowser.i18n.getMessage = ((key: string, subs?: string | string[]) => {
  const message = flat.get(key) ?? '';
  const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
  return substitute(
    message,
    list.map((sub) => String(sub)),
  );
}) as typeof fakeBrowser.i18n.getMessage;
