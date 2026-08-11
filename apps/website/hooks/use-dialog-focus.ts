import { useEffect, useRef, type RefObject } from 'react';

/**
 * Minimal, dependency-free keyboard focus management for modal/dialog
 * surfaces (WAI-ARIA dialog pattern):
 *
 * - On activation, moves focus to the first focusable element inside the
 *   dialog, or to the dialog container itself (tabIndex=-1) when there is
 *   none.
 * - Traps Tab / Shift+Tab inside the dialog while it is active.
 * - Invokes `onClose` on Escape (only when the surface is dismissible).
 * - Restores focus to the previously focused element when the dialog
 *   deactivates or unmounts, as long as that element is still connected.
 *
 * The hook adds no global listeners: the keydown handler lives on the
 * dialog element itself, so inactive dialogs (or dialogs that are not
 * mounted) leak nothing.
 *
 * @returns a ref to attach to the dialog element.
 */
export interface UseDialogFocusOptions {
  /** Whether this dialog is currently active (open). */
  active: boolean;
  /** Dismiss handler invoked on Escape. Omit for non-dismissible surfaces. */
  onClose?: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useDialogFocus<T extends HTMLElement = HTMLElement>({
  active,
  onClose,
}: UseDialogFocusOptions): RefObject<T> {
  const containerRef = useRef<T | null>(null);
  // Keep the latest handler without re-running the focus effect on every
  // render; refs are only touched inside effects (never during render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Initial focus: first focusable element, else the container itself.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      const current = document.activeElement as HTMLElement | null;

      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const currentIndex = items.indexOf(current as HTMLElement);
      if (event.shiftKey) {
        // Shift+Tab on the first item (or from outside the list, e.g. the
        // container itself) wraps to the last.
        if (currentIndex <= 0) {
          event.preventDefault();
          items[items.length - 1].focus();
        }
      } else if (currentIndex === -1 || currentIndex === items.length - 1) {
        // Tab on the last item (or from outside the list) wraps to the first.
        event.preventDefault();
        items[0].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus only when the trigger is still part of the document
      // (e.g. it was not unmounted together with the dialog).
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
