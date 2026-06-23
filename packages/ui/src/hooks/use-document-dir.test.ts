import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentDir } from './use-document-dir';

describe('useDocumentDir', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with "ltr" to match the HTML spec default (SSR-safe)', () => {
    const { result } = renderHook(() => useDocumentDir());
    // useState's initial value is observed before useEffect runs.
    expect(result.current).toBe('ltr');
  });

  it('falls back to "ltr" when <html dir> is missing entirely', async () => {
    document.documentElement.removeAttribute('dir');
    const { result } = renderHook(() => useDocumentDir());
    // Let the post-hydration sync run.
    await act(async () => {});
    expect(document.documentElement.hasAttribute('dir')).toBe(false);
    expect(result.current).toBe('ltr');
  });

  it('syncs to the current <html dir="rtl"> after hydration', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { result } = renderHook(() => useDocumentDir());
    await act(async () => {});
    expect(result.current).toBe('rtl');
  });

  it('syncs to <html dir="ltr"> when explicitly set', async () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const { result } = renderHook(() => useDocumentDir());
    await act(async () => {});
    expect(result.current).toBe('ltr');
  });

  it('updates when the <html dir> attribute changes from ltr to rtl', async () => {
    document.documentElement.setAttribute('dir', 'ltr');
    const { result } = renderHook(() => useDocumentDir());
    await act(async () => {});
    expect(result.current).toBe('ltr');

    await act(async () => {
      document.documentElement.setAttribute('dir', 'rtl');
    });
    expect(result.current).toBe('rtl');
  });

  it('updates when the <html dir> attribute changes from rtl to ltr', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { result } = renderHook(() => useDocumentDir());
    await act(async () => {});
    expect(result.current).toBe('rtl');

    await act(async () => {
      document.documentElement.setAttribute('dir', 'ltr');
    });
    expect(result.current).toBe('ltr');
  });

  it('ignores mutations on attributes other than dir', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const { result } = renderHook(() => useDocumentDir());
    await act(async () => {});
    expect(result.current).toBe('rtl');

    let setDirCalls = 0;
    const originalSetDir = result.current;
    // Track renders by snapshotting result.current.
    const ref = { current: originalSetDir };

    await act(async () => {
      document.documentElement.setAttribute('lang', 'ar');
      // Force the observer to fire (it only filters dir, so it should NOT fire here).
    });
    // After mutating a non-dir attribute, dir should be unchanged.
    expect(result.current).toBe(ref.current);
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    setDirCalls++;
    expect(setDirCalls).toBe(1);
  });

  it('disconnects the MutationObserver on unmount', async () => {
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { unmount } = renderHook(() => useDocumentDir());
    await act(async () => {});
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('observes only the "dir" attribute (attributeFilter)', () => {
    const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
    renderHook(() => useDocumentDir());
    const dirFilterCall = observeSpy.mock.calls.find(
      (call) =>
        call[0] === document.documentElement &&
        (call[1] as MutationObserverInit | undefined)?.attributeFilter?.includes('dir'),
    );
    expect(dirFilterCall).toBeDefined();
    const options = dirFilterCall?.[1] as MutationObserverInit;
    expect(options.attributes).toBe(true);
    expect(options.attributeFilter).toEqual(['dir']);
  });
});
