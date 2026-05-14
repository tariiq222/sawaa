import type { PublicBranding } from '@sawaa/shared';

import { getApiBase } from '@/lib/api-base';

export async function getPublicBrandingForSsr(): Promise<PublicBranding> {
  const response = await fetch(`${getApiBase()}/public/branding`, {
    next: { revalidate: 60, tags: ['branding'] },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public branding: ${response.status}`);
  }

  return response.json() as Promise<PublicBranding>;
}
