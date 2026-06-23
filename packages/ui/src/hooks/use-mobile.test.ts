import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

type Listener = (e: Pick<MediaQueryListEvent, 'matches'>) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatch: (next: boolean) => void;
}

let currentMatches = false;
let listeners: Listener[] = [];

function setupMatchMedia(initialMatches: boolean) {
  currentMatches = initialMatches;
  listeners = [];

  const mql: MockMediaQueryList = {
    media: '',
    get matches() {
      return currentMatches;
    },
    set matches(v: boolean) {
      currentMatches = v;
    },
    addEventListener: vi.fn((type: string, cb: EventListener) => {
      if (type === 'change') listeners.push(cb as unknown as Listener);
    }),
    removeEventListener: vi.fn((type: string, cb: EventListener) => {
      if (type === 'change') {
        listeners = listeners.filter((l) => l !== (cb as unknown as Listener));
      }
    }),
    dispatch(next: boolean) {
      currentMatches = next;
      const ev = { matches: next } as Pick<MediaQueryListEvent, 'matches'>;
      listeners.forEach((l) => l(ev));
    },
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      mql.media = query;
      return mql;
    }),
  );
  return mql;
}

describe('useIsMobile', () => {
  beforeEach(() => {
    // Default: desktop width 1024.
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns true when innerWidth is below the 768 breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    setupMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('returns false when innerWidth is at or above the 768 breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    setupMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('returns true at 767px (one below the breakpoint)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 767, configurable: true });
    setupMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('returns false at 768px (the breakpoint itself)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });
    setupMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('uses a (max-width: 767px) media query (breakpoint - 1)', async () => {
    setupMatchMedia(false);
    renderHook(() => useIsMobile());
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('reacts to matchMedia "change" events: false → true', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    const mql = setupMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(false);

    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    await act(async () => {
      mql.dispatch(true);
    });
    expect(result.current).toBe(true);
  });

  it('reacts to matchMedia "change" events: true → false', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    const mql = setupMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(true);

    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    await act(async () => {
      mql.dispatch(false);
    });
    expect(result.current).toBe(false);
  });

  it('removes the change listener on unmount (no leak)', async () => {
    setupMatchMedia(false);
    const { unmount, result } = renderHook(() => useIsMobile());
    await act(async () => {});
    expect(result.current).toBe(false);
    const mql = (window.matchMedia as unknown as () => MockMediaQueryList)();
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mql.removeEventListener).not.toHaveBeenCalled();
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
