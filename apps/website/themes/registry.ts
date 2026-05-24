import type { Theme } from './types';
import { SawaaLayout } from './sawaa/layout/layout';
import { SawaaHomePage } from './sawaa/pages/home';
import { SawaaTherapistsPage } from './sawaa/pages/therapists';
import { SawaaClinicsPage } from './sawaa/pages/clinics';
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

export const theme: Theme = {
  Layout: SawaaLayout,
  pages: {
    home: SawaaHomePage,
    therapists: SawaaTherapistsPage,
    clinics: SawaaClinicsPage,
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
};

if (!theme?.pages) {
  console.error('[FATAL] theme.pages is undefined — theme registry failed to initialize');
}
