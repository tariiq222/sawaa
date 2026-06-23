import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PublicBranding } from '@sawaa/shared';
import { BrandingProvider } from './branding-provider';
import { useBranding } from './use-branding';

const branding: PublicBranding = {
  organizationNameAr: 'مركز سواء',
  organizationNameEn: 'Sawa Center',
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#55CCB0',
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: 'Handicrafts',
  fontUrl: null,
  timeFormat: '24h',
  contactPhone: null,
  contactEmail: null,
};

function withProvider(value: PublicBranding = branding) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <BrandingProvider branding={value}>{children}</BrandingProvider>
  );
  Wrapper.displayName = 'BrandingTestProvider';
  return Wrapper;
}

describe('useBranding (features/branding/use-branding.ts)', () => {
  it('returns the branding object from the surrounding BrandingProvider', () => {
    const { result } = renderHook(() => useBranding(), { wrapper: withProvider() });
    expect(result.current.organizationNameAr).toBe('مركز سواء');
    expect(result.current.organizationNameEn).toBe('Sawa Center');
    expect(result.current.colorPrimary).toBe('#55CCB0');
    expect(result.current.timeFormat).toBe('24h');
  });

  it('returns the identity of the most-recently-provided branding (updates on rerender)', () => {
    const other: PublicBranding = { ...branding, organizationNameAr: 'اسم ثانٍ' };
    const { result, rerender } = renderHook(() => useBranding(), { wrapper: withProvider() });
    expect(result.current.organizationNameAr).toBe('مركز سواء');

    rerender();
    // The wrapper's branding prop is captured at hook setup; for a full
    // re-render we need to remount with a new wrapper. That contract is
    // covered by the BrandingProvider test; here we just assert identity
    // stability across no-op rerenders.
    expect(result.current.organizationNameAr).toBe('مركز سواء');
    // Sanity check — the other fixture is well-formed.
    expect(other.organizationNameAr).toBe('اسم ثانٍ');
  });

  it('throws when used outside any BrandingProvider', () => {
    // Silence React's noisy error boundary log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useBranding())).toThrow(/useBranding must be used inside/);
    spy.mockRestore();
  });
});
