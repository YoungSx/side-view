import { expect, it } from 'vitest';
import { i18n } from '#i18n';
import zhCN from '@/locales/zh_CN.json';
import { flattenMessages, setUiLanguage, substitute } from './runtime';

it('flattens nested keys to the build’s underscore form, unwrapping message objects', () => {
  const flat = flattenMessages({
    options: { general: { title: 'General' } },
    extName: { message: 'Side View' },
  });
  expect(flat.get('options_general_title')).toBe('General');
  expect(flat.get('extName')).toBe('Side View');
});

it('substitutes $1–$9 and leaves $$ literal', () => {
  expect(substitute('“$1” is invalid, $2 and $$', ['a', 'b'])).toBe('“a” is invalid, b and $');
});

it('retargets every t() call away from the browser locale and back', async () => {
  expect(i18n.t('options.heading')).toBe('Settings');

  await setUiLanguage('zh_CN');
  expect(i18n.t('options.heading')).toBe('设置');
  // Every real key exists in every locale (enforced by parity.test.ts), so a hit never falls back.
  expect(flattenMessages(zhCN).get('options_heading')).toBe('设置');

  await setUiLanguage('ja');
  expect(i18n.t('options.general.languageAuto')).toBe('ブラウザーに合わせる');

  await setUiLanguage('auto');
  expect(i18n.t('options.heading')).toBe('Settings');
});

it('applies substitutions to the override copy', async () => {
  await setUiLanguage('zh_CN');
  expect(i18n.t('options.advanced.overridesErrorInvalidSelector', ['timeline'])).toBe(
    '“timeline”不是有效的 CSS 选择器。',
  );
  await setUiLanguage('auto');
});
