import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PublicBranding } from '@deqah/shared/types';

const mockApiRequest = vi.fn();
vi.mock('../client.js', () => ({ apiRequest: mockApiRequest }));

const { getPublicBranding } = await import('./branding.js');

describe('getPublicBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GETs /api/public/branding and returns the PublicBranding payload', async () => {
    const mockResponse: PublicBranding = {
      organizationNameAr: 'عيادتي',
      organizationNameEn: 'My Clinic',
      productTagline: null,
      logoUrl: null,
      faviconUrl: null,
      colorPrimary: '#354FD8',
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

    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await getPublicBranding();

    expect(mockApiRequest).toHaveBeenCalledWith('/api/public/branding');
    expect(result).toEqual(mockResponse);
  });
});
