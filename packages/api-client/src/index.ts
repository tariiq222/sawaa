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
export {
  setMeBaseUrl,
  getMe,
  getMyBookings,
  cancelMyBooking,
  rescheduleMyBooking,
} from './modules/me'
export * as bookingsApi from './modules/bookings'
export * as employeesApi from './modules/employees'
export * as servicesApi from './modules/services'
export * as paymentsApi from './modules/payments'
