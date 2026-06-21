export { initClient, apiRequest, ApiError, ORG_SUSPENDED_CODE } from './client'
export type { ClientConfig } from './client'
export * from './types/index'
export * as authApi from './modules/auth'
export type { LoginPayload } from './modules/auth'
export {
  setClientBaseUrl,
  initClientAuth,
  clientLogin,
  clientRegister,
  clientLogout,
  clientResetPassword,
} from './modules/client-auth'
export type { ClientLoginRequest } from './modules/client-auth'
export {
  setMeBaseUrl,
  getMe,
  updateMyProfile,
  getMyInvoices,
  getMyBookings,
  cancelMyBooking,
  rescheduleMyBooking,
} from './modules/me'
export type { UpdateMyProfileRequest } from './modules/me'
export * as bookingsApi from './modules/bookings'
export * as employeesApi from './modules/employees'
export * as paymentsApi from './modules/payments'
export { requestRefund } from './modules/payments'
