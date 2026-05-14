import type { ComponentType, ReactNode } from 'react';
import type { WebsiteTheme } from '@deqah/shared';

export interface ThemeLayoutProps {
  children: ReactNode;
}

export interface Theme {
  name: WebsiteTheme;
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
