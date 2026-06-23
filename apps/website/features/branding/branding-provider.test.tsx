import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import type { PublicBranding } from '@sawaa/shared';
import { BrandingProvider, useBrandingContext } from './branding-provider';
import { useBranding } from './use-branding';

const branding: PublicBranding = {
  organizationNameAr: 'مركز سواء',
  organizationNameEn: 'Sawa Center',
  productTagline: 'استشارات أسرية بسرية تامة',
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#55CCB0',
  colorPrimaryLight: '#7CD8C2',
  colorPrimaryDark: '#0E4B43',
  colorAccent: '#E7DBC4',
  colorAccentDark: '#CAAF7B',
  colorBackground: '#EAF8F4',
  fontFamily: 'Handicrafts',
  fontUrl: null,
  timeFormat: '24h',
  contactPhone: '+966558446605',
  contactEmail: 'hello@sawa.test',
};

// Sentinel component that just calls the hook and renders the resolved
// branding object as a string so we can assert on it.
function Probe() {
  const ctx = useBrandingContext();
  return <span data-testid="probe">{JSON.stringify(ctx)}</span>;
}

// Variant that goes through the public alias to prove it is the same hook.
function ProbeAlias() {
  const ctx = useBranding();
  return <span data-testid="probe">{JSON.stringify(ctx)}</span>;
}

function withProvider(children: ReactNode, value: PublicBranding = branding) {
  return <BrandingProvider branding={value}>{children}</BrandingProvider>;
}

describe('BrandingProvider', () => {
  it('exposes the branding object to descendants via useBrandingContext', () => {
    render(
      withProvider(
        <Probe />,
      ),
    );
    const text = screen.getByTestId('probe').textContent ?? '';
    expect(text).toContain('"organizationNameAr":"مركز سواء"');
    expect(text).toContain('"organizationNameEn":"Sawa Center"');
    expect(text).toContain('"colorPrimary":"#55CCB0"');
    expect(text).toContain('"timeFormat":"24h"');
  });

  it('throws when useBrandingContext is called outside the provider', () => {
    // Silence React's noisy error boundary log — we expect the throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useBranding must be used inside/);
    spy.mockRestore();
  });

  it('exposes the same branding through the public useBranding alias', () => {
    render(
      withProvider(
        <ProbeAlias />,
      ),
    );
    const text = screen.getByTestId('probe').textContent ?? '';
    expect(text).toContain('"organizationNameAr":"مركز سواء"');
  });

  it('returns the most-recently-provided branding value (provider remounts cleanly)', () => {
    const other: PublicBranding = { ...branding, organizationNameAr: 'اسم ثاني' };
    const { rerender } = render(
      withProvider(<Probe />, branding),
    );
    expect(screen.getByTestId('probe').textContent).toContain('"organizationNameAr":"مركز سواء"');

    rerender(withProvider(<Probe />, other));
    expect(screen.getByTestId('probe').textContent).toContain('"organizationNameAr":"اسم ثاني"');
  });

  it('preserves the PublicBranding shape (all 14 fields are present in the exposed value)', () => {
    render(
      withProvider(
        <Probe />,
      ),
    );
    const text = screen.getByTestId('probe').textContent ?? '';
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // PublicBranding contract — assert each required field is wired through.
    expect(parsed.organizationNameAr).toBe('مركز سواء');
    expect(parsed.organizationNameEn).toBe('Sawa Center');
    expect(parsed.productTagline).toBe('استشارات أسرية بسرية تامة');
    expect(parsed.colorPrimary).toBe('#55CCB0');
    expect(parsed.colorPrimaryLight).toBe('#7CD8C2');
    expect(parsed.colorPrimaryDark).toBe('#0E4B43');
    expect(parsed.colorAccent).toBe('#E7DBC4');
    expect(parsed.colorAccentDark).toBe('#CAAF7B');
    expect(parsed.colorBackground).toBe('#EAF8F4');
    expect(parsed.fontFamily).toBe('Handicrafts');
    expect(parsed.timeFormat).toBe('24h');
    expect(parsed.contactPhone).toBe('+966558446605');
    expect(parsed.contactEmail).toBe('hello@sawa.test');
  });
});
