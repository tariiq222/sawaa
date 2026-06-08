import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandingStyle } from './branding-style';
import type { PublicBranding } from '@sawaa/shared';

const branding: PublicBranding = {
  organizationNameAr: 'عيادتي',
  organizationNameEn: null,
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: '#FF00AA',
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: null,
  fontUrl: null,
  timeFormat: '24h',
};

describe('BrandingStyle', () => {
  it('emits the fixed primary color, ignoring branding values', () => {
    const { container } = render(<BrandingStyle branding={branding} />);
    const style = container.querySelector('style');
    expect(style?.innerHTML).toContain('--primary: #55CCB0');
    expect(style?.innerHTML).not.toContain('#FF00AA');
  });

  it('emits the fixed accent color and Handicrafts font', () => {
    const { container } = render(<BrandingStyle branding={branding} />);
    const html = container.querySelector('style')?.innerHTML ?? '';
    expect(html).toContain('--accent: #E7DBC4');
    expect(html).toContain("--font-primary: 'Handicrafts', system-ui, sans-serif");
  });

  it('declares the local Handicrafts @font-face faces', () => {
    const { container } = render(<BrandingStyle branding={branding} />);
    const html = container.querySelector('style')?.innerHTML ?? '';
    expect(html).toContain('@font-face');
    expect(html).toContain('/fonts/Handicrafts-Regular.woff2');
    expect(html).toContain('font-display: swap');
  });
});
