import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { i18n } from '#i18n';
import { activeLanguage, applyStoredLanguage } from '@/i18n/runtime';
import { settings } from '@/settings/storage';
import { App } from './App';
import './style.css';

// Follow the OS colour scheme by toggling shadcn's `.dark` class on <html>. Duplicated from the
// settings page on purpose: a popup is a separate document, so it has to run this itself.
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (dark: boolean): void => {
  document.documentElement.classList.toggle('dark', dark);
};
applyTheme(media.matches);
media.addEventListener('change', (event) => applyTheme(event.matches));

// Retarget i18n before the first paint, or the popup flashes the browser's language for a frame.
await applyStoredLanguage();
document.title = i18n.t('popup.title');
document.documentElement.lang = activeLanguage(await settings.uiLanguage.getValue());

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
