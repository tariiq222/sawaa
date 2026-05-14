import type { WebsiteTheme } from '@deqah/shared';
import type { Theme } from './types';
import { SawaaLayout } from './sawaa/layout/layout';
import { SawaaHomePage } from './sawaa/pages/home';
import { SawaaTherapistsPage } from './sawaa/pages/therapists';
import { SawaaContactPage } from './sawaa/pages/contact';
import { SawaaBurnoutTestPage } from './sawaa/pages/burnout-test';
import { SawaaBookingPage } from './sawaa/pages/booking';
import { SawaaLoginPage } from './sawaa/pages/login';
import { SawaaRegisterPage } from './sawaa/pages/register';
import { SawaaForgotPasswordPage } from './sawaa/pages/forgot-password';
import { SawaaResetPasswordPage } from './sawaa/pages/reset-password';
import { SawaaAccountPage } from './sawaa/pages/account';
import { SawaaAccountBookingsPage } from './sawaa/pages/account-bookings';
import { SawaaAccountBookingDetailPage } from './sawaa/pages/account-booking-detail';
import { SawaaSupportGroupsPage } from './sawaa/pages/support-groups';
import { PremiumLayout } from './premium/layout/layout';
import { PremiumHomePage } from './premium/pages/home';
import { PremiumTherapistsPage } from './premium/pages/therapists';
import { PremiumContactPage } from './premium/pages/contact';
import { PremiumBurnoutTestPage } from './premium/pages/burnout-test';
import { PremiumBookingPage } from './premium/pages/booking';
import { PremiumLoginPage } from './premium/pages/login';
import { PremiumRegisterPage } from './premium/pages/register';
import { PremiumForgotPasswordPage } from './premium/pages/forgot-password';
import { PremiumResetPasswordPage } from './premium/pages/reset-password';
import { PremiumAccountPage } from './premium/pages/account';
import { PremiumAccountBookingsPage } from './premium/pages/account-bookings';
import { PremiumAccountBookingDetailPage } from './premium/pages/account-booking-detail';
import { PremiumSupportGroupsPage } from './premium/pages/support-groups';

export const themes: Record<WebsiteTheme, Theme> = {
  SAWAA: {
    name: 'SAWAA',
    Layout: SawaaLayout,
    pages: {
      home: SawaaHomePage,
      therapists: SawaaTherapistsPage,
      contact: SawaaContactPage,
      burnoutTest: SawaaBurnoutTestPage,
      booking: SawaaBookingPage,
      login: SawaaLoginPage,
      register: SawaaRegisterPage,
      forgotPassword: SawaaForgotPasswordPage,
      resetPassword: SawaaResetPasswordPage,
      account: SawaaAccountPage,
      accountBookings: SawaaAccountBookingsPage,
      accountBookingDetail: SawaaAccountBookingDetailPage,
      supportGroups: SawaaSupportGroupsPage,
    },
  },
  PREMIUM: {
    name: 'PREMIUM',
    Layout: PremiumLayout,
    pages: {
      home: PremiumHomePage,
      therapists: PremiumTherapistsPage,
      contact: PremiumContactPage,
      burnoutTest: PremiumBurnoutTestPage,
      booking: PremiumBookingPage,
      login: PremiumLoginPage,
      register: PremiumRegisterPage,
      forgotPassword: PremiumForgotPasswordPage,
      resetPassword: PremiumResetPasswordPage,
      account: PremiumAccountPage,
      accountBookings: PremiumAccountBookingsPage,
      accountBookingDetail: PremiumAccountBookingDetailPage,
      supportGroups: PremiumSupportGroupsPage,
    },
  },
};
