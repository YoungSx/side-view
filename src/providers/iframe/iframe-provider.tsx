import { createRoot, type Root } from 'react-dom/client';
import type { DetailColumnProvider, DetailIntent, PlatformAdapter } from '@/core/types';
import { IframeColumn } from './IframeColumn';

/**
 * Each main-page selection starts a new same-origin iframe reading context, even for the same URL.
 * Internal navigation remains native. Intent state lives here (not in the layout), so it survives
 * the shadow host being re-mounted after a host-page re-render: `mount()` gets a fresh container
 * each time and re-renders the current intent.
 */
export class IframeColumnProvider implements DetailColumnProvider {
  private root: Root | null = null;
  private intent: DetailIntent | null = null;
  private reading = 0;

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
    this.reading++;
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

  /** Re-render the open column so it picks up text read from i18n at render time (e.g. a
   * language change). No-op when nothing is open. */
  refreshLabels(): void {
    this.render();
  }

  private readonly clear = (): void => {
    this.intent = null;
    this.onClose();
  };

  private readonly findHeader = (doc: Document): HTMLElement | null =>
    this.adapter.detailHeader(doc);

  private render(): void {
    if (!this.intent) return;
    this.root?.render(
      <IframeColumn
        key={this.reading}
        intent={this.intent}
        frameName={this.adapter.detailFrameName}
        frameUrl={this.adapter.detailFrameUrl(this.intent.url)}
        findHeader={this.findHeader}
        onClose={this.clear}
      />,
    );
  }
}
