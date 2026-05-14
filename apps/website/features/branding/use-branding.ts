'use client';

import { useBrandingContext } from './branding-provider';

export function useBranding() {
  return useBrandingContext();
}
