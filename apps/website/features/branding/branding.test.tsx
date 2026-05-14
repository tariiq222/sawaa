import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandingStyle } from './branding-style';
import type { PublicBranding } from '@deqah/shared';

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
  websiteDomain: null,
  activeWebsiteTheme: 'SAWAA',
};

describe('BrandingStyle', () => {
  it('emits the primary color as a CSS variable', () => {
    const { container } = render(<BrandingStyle branding={branding} />);
    const style = container.querySelector('style');
    expect(style?.innerHTML).toContain('--primary: #FF00AA');
  });

  it('falls back to defaults when a field is null', () => {
    const { container } = render(
      <BrandingStyle branding={{ ...branding, colorAccent: null }} />,
    );
    expect(container.querySelector('style')?.innerHTML).toContain(
      '--accent: #82CC17',
    );
  });
});
