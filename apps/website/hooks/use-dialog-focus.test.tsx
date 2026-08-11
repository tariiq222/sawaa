import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useDialogFocus } from './use-dialog-focus';

/**
 * Harness that keeps the dialog element mounted and toggles `active`, so the
 * tests exercise the hook's focus management independent of any component
 * unmounting behavior.
 */
function Harness({
  active,
  onClose,
  noFocusable = false,
  label = 'test-dialog',
}: {
  active: boolean;
  onClose?: () => void;
  noFocusable?: boolean;
  label?: string;
}) {
  const ref = useDialogFocus<HTMLDivElement>({ active, onClose });
  return (
    <div>
      <button type="button" data-testid="trigger">
        Open
      </button>
      <div ref={ref} role="dialog" data-testid="dialog" aria-label={label}>
        {noFocusable ? null : (
          <>
            <button type="button" data-testid="first">
              First
            </button>
            <button type="button" data-testid="last">
              Last
            </button>
          </>
        )}
      </div>
    </div>
  );
}

describe('useDialogFocus', () => {
  it('focuses the first focusable element when activated', () => {
    render(<Harness active />);
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('focuses the dialog container with tabIndex=-1 when nothing is focusable', () => {
    render(<Harness active noFocusable />);
    const dialog = screen.getByTestId('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(dialog);
  });

  it('does not move focus while inactive', () => {
    render(<Harness active={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByTestId('dialog')).not.toHaveFocus();
  });

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Harness active />);
    const last = screen.getByTestId('last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    render(<Harness active />);
    const first = screen.getByTestId('first');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('last'));
  });

  it('sends Tab from the dialog container to the first focusable', () => {
    render(<Harness active />);
    const dialog = screen.getByTestId('dialog');
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Harness active onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape when no onClose is provided', () => {
    render(<Harness active />);
    const first = screen.getByTestId('first');
    first.focus();
    fireEvent.keyDown(screen.getByTestId('dialog'), { key: 'Escape' });
    expect(document.activeElement).toBe(first);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not call onClose when inactive (no listener leak)', () => {
    const onClose = vi.fn();
    render(<Harness active={false} onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the previously focused element when deactivated', () => {
    const { rerender } = render(<Harness active={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    rerender(<Harness active />);
    // Opening steals focus to the first focusable…
    expect(document.activeElement).toBe(screen.getByTestId('first'));
    rerender(<Harness active={false} />);
    // …and deactivating restores it to the trigger.
    expect(document.activeElement).toBe(trigger);
  });

  it('skips focus restoration when the previously focused element is disconnected', () => {
    const { rerender } = render(<Harness active={false} />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    rerender(<Harness active />);
    trigger.remove();
    expect(() => rerender(<Harness active={false} />)).not.toThrow();
    // The trigger is gone; focus must not be thrown at a detached node and
    // stays where it was inside the (still mounted) dialog.
    expect(document.activeElement).toBe(screen.getByTestId('first'));
    expect(trigger.isConnected).toBe(false);
  });

  it('is safe when an inactive dialog coexists with an active one', () => {
    render(
      <>
        <Harness active={false} label="inactive" />
        <Harness active label="active" />
      </>,
    );
    const dialogs = screen.getAllByTestId('dialog');
    expect(dialogs).toHaveLength(2);
    // The inactive dialog must not steal focus…
    expect(dialogs[0]).not.toHaveFocus();
    // …while the active one moves focus to its first focusable.
    expect(document.activeElement).toBe(screen.getAllByTestId('first')[1]);
  });
});
