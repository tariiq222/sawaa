import type { ComponentType, ReactNode } from 'react';

export interface ThemeLayoutProps {
  children: ReactNode;
}

export interface Theme {
  Layout: ComponentType<ThemeLayoutProps>;
  pages: {
    home: ComponentType;
    therapists: ComponentType;
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
  };
}
