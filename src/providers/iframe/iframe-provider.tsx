import { createRoot, type Root } from 'react-dom/client';
import type { DetailColumnProvider, DetailIntent, PlatformAdapter } from '@/core/types';
import { IframeColumn } from './IframeColumn';

/**
 * Renders the detail column with a reused same-origin `<iframe>` that shows the platform's own
 * native thread/profile/search view. Intent state lives here (not in the layout), so it survives
 * the shadow host being re-mounted after a host-page re-render: `mount()` gets a fresh container
 * each time and re-renders the current intent.
 */
export class IframeColumnProvider implements DetailColumnProvider {
  private root: Root | null = null;
  private intent: DetailIntent | null = null;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly onClose: () => void,
  ) {}

  mount(container: HTMLElement): void {
    // WXT's mount() offers no already-mounted guard and does not pair onRemove before a re-mount
    // during host-page DOM replacement. Unmount any prior root first so a
    // second onMount can never orphan a React root and its still-loaded detail iframe.
    this.root?.unmount();
    this.root = createRoot(container);
    this.render();
  }

  open(intent: DetailIntent): void {
    this.intent = intent;
    this.render();
  }

  replaceContent(intent: DetailIntent): void {
    this.open(intent);
  }

  unmount(): void {
    this.root?.unmount();
    this.root = null;
  }

  destroy(): void {
    this.unmount();
    this.intent = null;
  }

  private readonly clear = (): void => {
    this.intent = null;
    this.onClose();
  };

  private render(): void {
    if (!this.intent) return;
    this.root?.render(
      <IframeColumn
        intent={this.intent}
        frameName={this.adapter.detailFrameName}
        frameUrl={this.adapter.detailFrameUrl(this.intent.url)}
        onClose={this.clear}
      />,
    );
  }
}
