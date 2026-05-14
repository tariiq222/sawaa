'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicBranding } from '@deqah/shared';

const BrandingContext = createContext<PublicBranding | null>(null);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: PublicBranding;
  children: ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBrandingContext(): PublicBranding {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error('useBranding must be used inside <BrandingProvider>');
  }
  return ctx;
}
