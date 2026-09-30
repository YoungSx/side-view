/**
 * jsdom gaps that Radix primitives hit on mount, filled before any test renders.
 *
 * `ResizeObserver` is the one that matters today: the Slider thumb measures itself through
 * `@radix-ui/react-use-size`, which reads it during a layout effect. Without the stub, rendering
 * the popup throws before a single assertion runs. Reporting zero size is the honest answer for
 * jsdom — it lays out nothing — and it is enough for the thumb to render and take keyboard input.
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}
