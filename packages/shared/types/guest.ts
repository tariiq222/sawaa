import type { OtpChannel, OtpPurpose } from '../enums/otp';
import type { UserGender } from '../enums/user';

export interface OtpRequestPayload {
  channel: OtpChannel;
  identifier: string;
  purpose: OtpPurpose;
  hCaptchaToken: string;
}

export interface OtpVerifyPayload {
  channel: OtpChannel;
  identifier: string;
  code: string;
  purpose: OtpPurpose;
  hCaptchaToken: string;
}

export interface OtpVerifyResponse {
  sessionToken: string;
}

export interface GuestClientInfo {
  name: string;
  phone: string;
  email: string;
  gender?: UserGender;
  notes?: string;
}

export interface GuestBookingPayload {
  serviceId: string;
  employeeId: string;
  branchId: string;
  startsAt: string;
  client: GuestClientInfo;
}

export interface GuestBookingResponse {
  bookingId: string;
  invoiceId: string;
  totalHalalat: number;
}

export interface InitPaymentResponse {
  paymentId: string;
  redirectUrl: string;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}