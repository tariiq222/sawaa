import type { ComponentType, ReactNode } from 'react';

export interface ThemeLayoutProps {
  children: ReactNode;
}

export interface Theme {
  Layout: ComponentType<ThemeLayoutProps>;
  pages: {
    home: ComponentType;
    therapists: ComponentType<{ initialSpecialty?: string | null }>;
    clinics: ComponentType;
    services: ComponentType;
    contact: ComponentType;
    burnoutTest: ComponentType;
    booking: ComponentType;
    login: ComponentType;
    register: ComponentType;
    forgotPassword: ComponentType;
    resetPassword: ComponentType;
    account: ComponentType;
    accountBookings: ComponentType<{ searchParams: Promise<Record<string, string | undefined>> }>;
    accountBookingDetail: ComponentType<{ bookingId: string }>;
    supportGroups: ComponentType;
    packages: ComponentType;
    packageDetail: ComponentType<{ familyId: string }>;
    packagePurchase: ComponentType<{ packageId: string; packageFamilyId?: string }>;
    accountPackages: ComponentType<{ creditId?: string }>;
  };
}
