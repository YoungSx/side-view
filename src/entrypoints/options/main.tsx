import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { i18n } from '#i18n';
import { browser } from '#imports';
import { App } from './App';
import './style.css';

// Follow the OS colour scheme by toggling shadcn's `.dark` class on <html>.
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (dark: boolean): void => {
  document.documentElement.classList.toggle('dark', dark);
};
applyTheme(media.matches);
media.addEventListener('change', (event) => applyTheme(event.matches));

document.title = i18n.t('options.title');
const uiLanguage = browser.i18n.getUILanguage?.();
if (uiLanguage) document.documentElement.lang = uiLanguage;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
