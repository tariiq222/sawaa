/**
 * Identity handler roster, kept out of the module file so it stays inside the
 * 120-line budget (MNT-20, owner-approved). Registration order is unchanged:
 * this array is spread into providers and exports exactly as before.
 */
import { EmployeeContactStore } from './employee-contact/employee-contact.store';
import { RequestEmployeeContactHandler } from './employee-contact/request-employee-contact.handler';
import { VerifyEmployeeContactHandler } from './employee-contact/verify-employee-contact.handler';
import { ClientPhoneStore } from './client-phone/client-phone.store';
import { RequestClientPhoneHandler } from './client-phone/request-client-phone.handler';
import { VerifyClientPhoneHandler } from './client-phone/verify-client-phone.handler';
import { ClientEmailStore } from './client-email/client-email.store';
import { GetClientEmailStatusHandler } from './client-email/get-client-email-status.handler';
import { RequestClientEmailHandler } from './client-email/request-client-email.handler';
import { VerifyClientEmailHandler } from './client-email/verify-client-email.handler';
import { DeclineClientEmailHandler } from './client-email/decline-client-email.handler';
import { MobilePhoneFlowStore } from './mobile-phone-entry/mobile-phone-flow.store';
import { RequestPhoneEntryHandler } from './mobile-phone-entry/request-phone-entry.handler';
import { ResendPhoneEntryHandler } from './mobile-phone-entry/resend-phone-entry.handler';
import { VerifyPhoneEntryHandler } from './mobile-phone-entry/verify-phone-entry.handler';
import { CompletePhoneEntryHandler } from './mobile-phone-entry/complete-phone-entry.handler';
import { MobileEmailFlowStore } from './mobile-email-entry/mobile-email-flow.store';
import { MobileEmailIdentity } from './mobile-email-entry/mobile-email-identity';
import { MobileEmailSendLimiter } from './mobile-email-entry/mobile-email-send-limiter';
import { MobileEmailDelivery } from './mobile-email-entry/mobile-email-delivery';
import { MobileEmailPhoneDispatch } from './mobile-email-entry/mobile-email-phone-dispatch';
import { RequestEmailEntryHandler } from './mobile-email-entry/request-email-entry.handler';
import { VerifyEmailEntryHandler } from './mobile-email-entry/verify-email-entry.handler';
import { RequestEmailEntryPhoneHandler } from './mobile-email-entry/request-email-entry-phone.handler';
import { ResendEmailEntryPhoneHandler } from './mobile-email-entry/resend-email-entry-phone.handler';
import { VerifyEmailEntryPhoneHandler } from './mobile-email-entry/verify-email-entry-phone.handler';
import { ReviewLoginHandler } from './review-login/review-login.handler';
import { ReviewOtpHandler } from './review-otp/review-otp.handler';
import { LoginHandler } from './login/login.handler';
import { RefreshTokenHandler } from './refresh-token/refresh-token.handler';
import { LogoutHandler } from './logout/logout.handler';
import { GetCurrentUserHandler } from './get-current-user/get-current-user.handler';
import { CreateUserHandler } from './users/create-user.handler';
import { GetUserHandler } from './users/get-user.handler';
import { UpdateUserHandler } from './users/update-user.handler';
import { UpdateUserRoleHandler } from './users/update-user-role.handler';
import { ListUsersHandler } from './users/list-users.handler';
import { DeactivateUserHandler } from './users/deactivate-user.handler';
import { DeleteUserHandler } from './users/delete-user.handler';
import { AssignRoleHandler } from './users/assign-role.handler';
import { RemoveRoleHandler } from './users/remove-role.handler';
import { CreateRoleHandler } from './roles/create-role.handler';
import { DeleteRoleHandler } from './roles/delete-role.handler';
import { AssignPermissionsHandler } from './roles/assign-permissions.handler';
import { ListRolesHandler } from './roles/list-roles.handler';
import { ListPermissionsHandler } from './roles/list-permissions.handler';
import { ChangePasswordHandler } from './users/change-password.handler';
import { RequestOtpHandler } from './otp/request-otp.handler';
import { VerifyOtpHandler } from './otp/verify-otp.handler';
import { RegisterHandler } from './client-auth/register.handler';
import { MobilePasswordLoginHandler } from './mobile-password-login/mobile-password-login.handler';
import { ClientLoginHandler } from './client-auth/client-login.handler';
import { ClientRefreshHandler } from './client-auth/client-refresh.handler';
import { ClientLogoutHandler } from './client-auth/client-logout.handler';
import { GetMeHandler } from './client-auth/get-me.handler';
import { UpdateClientProfileHandler } from './client-auth/update-client-profile.handler';
import { ResetPasswordHandler } from './client-auth/reset-password/reset-password.handler';
import { RequestPasswordResetHandler } from './user-password-reset/request-password-reset/request-password-reset.handler';
import { PerformPasswordResetHandler } from './user-password-reset/perform-password-reset/perform-password-reset.handler';
import { RegisterMobileUserHandler } from './register-mobile-user/register-mobile-user.handler';
import { RequestMobileLoginOtpHandler } from './request-mobile-login-otp/request-mobile-login-otp.handler';
import { VerifyMobileOtpHandler } from './verify-mobile-otp/verify-mobile-otp.handler';
import { RequestEmailVerificationHandler } from './request-email-verification/request-email-verification.handler';
import { VerifyEmailHandler } from './verify-email/verify-email.handler';
import { RequestDashboardOtpHandler } from './request-dashboard-otp/request-dashboard-otp.handler';
import { VerifyDashboardOtpHandler } from './verify-dashboard-otp/verify-dashboard-otp.handler';
import { LookupUserHandler } from './lookup-user/lookup-user.handler';
import { GetEmployeeAccountHandler } from './employee-account/get-employee-account.handler';
import { CreateEmployeeAccountHandler } from './employee-account/create-employee-account.handler';
import { UpdateEmployeeAccountHandler } from './employee-account/update-employee-account.handler';
import { NativeSessionLookup } from './native-session/native-session.lookup';
import { NativeRefreshHandler } from './native-session/native-refresh.handler';
import { NativeLogoutHandler } from './native-session/native-logout.handler';
import { RequestAccountDeletionHandler } from './request-account-deletion/request-account-deletion.handler';

export const identityHandlers = [
  MobilePhoneFlowStore, RequestPhoneEntryHandler, ResendPhoneEntryHandler, VerifyPhoneEntryHandler, CompletePhoneEntryHandler,
  EmployeeContactStore, RequestEmployeeContactHandler, VerifyEmployeeContactHandler,
  ClientEmailStore, GetClientEmailStatusHandler, RequestClientEmailHandler, VerifyClientEmailHandler, DeclineClientEmailHandler,
  ClientPhoneStore, RequestClientPhoneHandler, VerifyClientPhoneHandler,
  MobileEmailFlowStore, MobileEmailIdentity, MobileEmailSendLimiter, MobileEmailDelivery, MobileEmailPhoneDispatch, RequestEmailEntryHandler, VerifyEmailEntryHandler, RequestEmailEntryPhoneHandler, ResendEmailEntryPhoneHandler, VerifyEmailEntryPhoneHandler,
  ReviewLoginHandler, ReviewOtpHandler,
  LoginHandler, RefreshTokenHandler, LogoutHandler,
  GetCurrentUserHandler, CreateUserHandler, GetUserHandler, UpdateUserHandler, UpdateUserRoleHandler, ListUsersHandler,
  DeactivateUserHandler, DeleteUserHandler, AssignRoleHandler, RemoveRoleHandler,
  CreateRoleHandler, DeleteRoleHandler, AssignPermissionsHandler, ListRolesHandler,
  ListPermissionsHandler,
  ChangePasswordHandler,
  RequestPasswordResetHandler,
  PerformPasswordResetHandler,
  RequestOtpHandler,
  VerifyOtpHandler,
  RegisterHandler,
  ClientLoginHandler,
  MobilePasswordLoginHandler,
  ClientRefreshHandler,
  ClientLogoutHandler,
  GetMeHandler,
  UpdateClientProfileHandler,
  ResetPasswordHandler,
  RegisterMobileUserHandler,
  RequestMobileLoginOtpHandler,
  VerifyMobileOtpHandler,
  RequestEmailVerificationHandler,
  VerifyEmailHandler,
  RequestDashboardOtpHandler,
  VerifyDashboardOtpHandler,
  LookupUserHandler,
  GetEmployeeAccountHandler,
  CreateEmployeeAccountHandler,
  UpdateEmployeeAccountHandler,
  NativeSessionLookup,
  NativeRefreshHandler,
  NativeLogoutHandler,
  RequestAccountDeletionHandler,
];
