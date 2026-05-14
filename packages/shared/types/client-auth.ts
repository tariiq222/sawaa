import type { UserGender } from '../enums/user';

export interface ClientProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: UserGender | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ClientBookingItem {
  id: string;
  status: string;
  scheduledAt: string;
  endsAt: string;
  durationMins: number;
  price: string;
  currency: string;
  serviceName: string;
  serviceNameAr: string | null;
  employeeName: string;
  employeeNameAr: string | null;
  branchName: string;
  branchNameAr: string | null;
  paymentStatus: string;
  createdAt: string;
}

export interface ClientBookingListResponse {
  items: ClientBookingItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientAuthResponse {
  accessToken: string;
  refreshToken: string;
  clientId: string;
}

export interface ClientLoginPayload {
  email: string;
  password: string;
}

export interface ClientRegisterPayload {
  otpSessionToken: string;
  password: string;
  name?: string;
}

export interface CancelMyBookingPayload {
  reason?: string;
}

export interface RescheduleMyBookingPayload {
  newScheduledAt: string;
  newDurationMins?: number;
}
