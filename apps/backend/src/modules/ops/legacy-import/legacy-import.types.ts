export type LegacyAppointmentStatus =
  | 'approved'
  | 'canceled'
  | 'pending'
  | 'rejected';

export interface LegacyAppointment {
  id: number;
  locationId: number;
  serviceId: number;
  staffId: number;
  customerId: number;
  startsAt: number;
  endsAt: number;
  status: LegacyAppointmentStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paidAmount: string;
  note: string | null;
  createdAt: number | null;
}

export interface LegacyCustomer {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthdate: string | null;
  notes: string | null;
  gender: string | null;
  createdAt: string | null;
}

export interface LegacyStaff {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  profession: string | null;
  isActive: boolean;
}

export interface LegacyService {
  id: number;
  categoryId: number | null;
  name: string;
  price: string;
  duration: number;
  isActive: boolean;
}

export interface LegacyServiceCategory {
  id: number;
  name: string;
}

export interface LegacyLocation {
  id: number;
  name: string;
}

export interface LegacyForm {
  id: number;
  name: string;
  serviceIds: string | null;
}

export interface LegacyFormInput {
  id: number;
  formId: number;
  type: string;
  label: string;
  isRequired: boolean;
  orderNumber: number;
}

export interface LegacyFormInputChoice {
  id: number;
  formInputId: number;
  title: string;
  orderNumber: number;
}

export interface LegacyAppointmentCustomData {
  id: number;
  appointmentId: number;
  formInputId: number;
  inputValue: string | null;
  inputFileName: string | null;
}

export interface LegacyBundleCounts {
  appointments: number;
  customers: number;
  staff: number;
  services: number;
  locations: number;
  customData: number;
}

export interface LegacyBundleV1 {
  schemaVersion: 1;
  sourceSystem: 'booknetic';
  sourceTenant: 6;
  extractedAt: string;
  counts: LegacyBundleCounts;
  appointments: LegacyAppointment[];
  customers: LegacyCustomer[];
  staff: LegacyStaff[];
  services: LegacyService[];
  serviceCategories: LegacyServiceCategory[];
  locations: LegacyLocation[];
  forms: LegacyForm[];
  formInputs: LegacyFormInput[];
  formInputChoices: LegacyFormInputChoice[];
  appointmentCustomData: LegacyAppointmentCustomData[];
}

export interface AppointmentPartition {
  historical: LegacyAppointment[];
  excluded: LegacyAppointment[];
}
