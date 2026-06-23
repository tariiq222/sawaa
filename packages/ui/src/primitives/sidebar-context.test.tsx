import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import {
  SidebarProvider,
  useSidebar,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from './sidebar-context';

function setupMatchMedia(initialMatches = false) {
  let matches = initialMatches;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  return {
    set: (v: boolean) => {
      matches = v;
    },
  };
}

function readCookie(): string | null {
  // jsdom sets document.cookie in a single name=value chain.
  const all = document.cookie;
  if (!all) return null;
  const parts = all.split(';').map((p) => p.trim());
  for (const p of parts) {
    const [k, ...v] = p.split('=');
    if (k === SIDEBAR_COOKIE_NAME) return v.join('=');
  }
  return null;
}

function Probe() {
  const ctx = useSidebar();
  return (
    <div>
      <span data-testid="state">{ctx.state}</span>
      <span data-testid="open">{String(ctx.open)}</span>
      <span data-testid="isMobile">{String(ctx.isMobile)}</span>
      <span data-testid="openMobile">{String(ctx.openMobile)}</span>
      <button data-testid="toggle" onClick={ctx.toggleSidebar}>
        toggle
      </button>
      <button data-testid="setOpenTrue" onClick={() => ctx.setOpen(true)}>
        setOpen(true)
      </button>
      <button data-testid="setOpenFalse" onClick={() => ctx.setOpen(false)}>
        setOpen(false)
      </button>
    </div>
  );
}

describe('sidebar-context', () => {
  beforeEach(() => {
    // Clear any cookies set by previous tests.
    document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setupMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
  });

  describe('useSidebar outside a provider', () => {
    it('throws a descriptive error', () => {
      // Suppress React's error boundary log for this expected throw.
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<Probe />)).toThrow(
        /useSidebar must be used within a SidebarProvider/,
      );
      errSpy.mockRestore();
    });
  });

  describe('default (uncontrolled) state', () => {
    it('opens by default (defaultOpen=true) and exposes state="expanded"', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('open').textContent).toBe('true');
      expect(screen.getByTestId('state').textContent).toBe('expanded');
    });

    it('respects defaultOpen={false}', async () => {
      render(
        <SidebarProvider defaultOpen={false}>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('open').textContent).toBe('false');
      expect(screen.getByTestId('state').textContent).toBe('collapsed');
    });

    it('toggleSidebar flips the open state from true to false', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('open').textContent).toBe('true');
      await act(async () => {
        screen.getByTestId('toggle').click();
      });
      expect(screen.getByTestId('open').textContent).toBe('false');
      expect(screen.getByTestId('state').textContent).toBe('collapsed');
    });

    it('persists the open state to the sidebar_state cookie on every setOpen call', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      // Initial value should NOT yet be in the cookie (no setOpen fired yet).
      expect(readCookie()).toBeNull();

      await act(async () => {
        screen.getByTestId('setOpenFalse').click();
      });
      expect(readCookie()).toBe('false');

      await act(async () => {
        screen.getByTestId('setOpenTrue').click();
      });
      expect(readCookie()).toBe('true');
    });

    it('toggleSidebar persists the new state to the cookie', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      await act(async () => {
        screen.getByTestId('toggle').click();
      });
      expect(readCookie()).toBe('false');
    });
  });

  describe('controlled state (open + onOpenChange)', () => {
    it('reflects the open prop value and routes updates through onOpenChange', async () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <SidebarProvider open={true} onOpenChange={onOpenChange}>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('open').textContent).toBe('true');
      expect(onOpenChange).not.toHaveBeenCalled();

      rerender(
        <SidebarProvider open={false} onOpenChange={onOpenChange}>
          <Probe />
        </SidebarProvider>,
      );
      expect(screen.getByTestId('open').textContent).toBe('false');
      expect(onOpenChange).not.toHaveBeenCalled();

      // setOpen in controlled mode MUST call onOpenChange, NOT mutate internal state.
      await act(async () => {
        screen.getByTestId('setOpenTrue').click();
      });
      expect(onOpenChange).toHaveBeenCalledWith(true);
      // Internal state must still reflect the controlled prop (false), not the
      // optimistic true. The provider does not duplicate state in controlled mode.
      expect(screen.getByTestId('open').textContent).toBe('false');
    });

    it('still writes the cookie in controlled mode (matches the shadcn upstream pattern)', async () => {
      // The provider writes the cookie on every setOpen call regardless of
      // controlled vs uncontrolled. In controlled mode the consumer's onOpenChange
      // is also called. The cookie is "best-effort" persistence — the consumer
      // remains the source of truth for the controlled `open` prop.
      const onOpenChange = vi.fn();
      render(
        <SidebarProvider open={true} onOpenChange={onOpenChange}>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      await act(async () => {
        screen.getByTestId('setOpenFalse').click();
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(readCookie()).toBe('false');
    });
  });

  describe('keyboard shortcut', () => {
    it('toggles the sidebar on Ctrl+B (Windows/Linux)', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('open').textContent).toBe('true');

      await act(async () => {
        fireEvent.keyDown(window, { key: SIDEBAR_KEYBOARD_SHORTCUT, ctrlKey: true });
      });
      expect(screen.getByTestId('open').textContent).toBe('false');
      expect(readCookie()).toBe('false');
    });

    it('toggles the sidebar on Cmd+B (macOS metaKey)', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      await act(async () => {
        fireEvent.keyDown(window, { key: SIDEBAR_KEYBOARD_SHORTCUT, metaKey: true });
      });
      expect(screen.getByTestId('open').textContent).toBe('false');
    });

    it('ignores a bare "b" press without Ctrl/Cmd', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      await act(async () => {
        fireEvent.keyDown(window, { key: SIDEBAR_KEYBOARD_SHORTCUT });
      });
      expect(screen.getByTestId('open').textContent).toBe('true');
    });

    it('ignores Ctrl + a different letter', async () => {
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      await act(async () => {
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      });
      expect(screen.getByTestId('open').textContent).toBe('true');
    });

    it('removes the keydown listener on unmount', async () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      unmount();
      const removedKeydown = removeSpy.mock.calls.some(
        (c) => c[0] === 'keydown',
      );
      expect(removedKeydown).toBe(true);
    });
  });

  describe('mobile path', () => {
    it('toggleSidebar flips openMobile (not open) when isMobile is true', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      setupMatchMedia(true);
      render(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
      await act(async () => {});
      expect(screen.getByTestId('isMobile').textContent).toBe('true');
      expect(screen.getByTestId('open').textContent).toBe('true');
      expect(screen.getByTestId('openMobile').textContent).toBe('false');

      await act(async () => {
        screen.getByTestId('toggle').click();
      });
      // open (desktop) is unchanged; openMobile flips.
      expect(screen.getByTestId('open').textContent).toBe('true');
      expect(screen.getByTestId('openMobile').textContent).toBe('true');
    });
  });
});
