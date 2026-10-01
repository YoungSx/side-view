import { frameNavigation } from '@/core/navigation';

/** X's history.back() traverses the tab's joint history, including our iframe's entries. */
export function installXMainBack(
  doc: Document,
  isOpen: () => boolean,
  close: () => void,
): () => void {
  const back = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      !isOpen()
    )
      return;
    const target = event.target as Element | null;
    if (!target?.closest?.('[data-testid="primaryColumn"] [data-testid="app-bar-back"]')) return;
    if (target.closest('[role="dialog"]')) return;

    const navigation = frameNavigation(doc.defaultView);
    const index = navigation?.currentEntry?.index;
    // Capture the main frame's destination BEFORE removing the child navigable.
    const previous = index === undefined ? undefined : navigation?.entries()[index - 1];
    close();
    // No same-origin predecessor (or no Navigation API): let X choose its native fallback.
    if (!navigation || !previous) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = navigation.traverseTo(previous.key);
    // An aborted traversal must not trigger a second, joint-history traversal.
    void result.committed.catch(() => {});
    void result.finished.catch(() => {});
  };
  doc.addEventListener('click', back, true);
  return () => doc.removeEventListener('click', back, true);
}
