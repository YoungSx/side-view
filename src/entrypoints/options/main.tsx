import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';

// Follow the OS colour scheme by toggling shadcn's `.dark` class on <html>.
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (dark: boolean): void => {
  document.documentElement.classList.toggle('dark', dark);
};
applyTheme(media.matches);
media.addEventListener('change', (event) => applyTheme(event.matches));

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
