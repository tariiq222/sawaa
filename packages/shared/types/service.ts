export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  categoryId: string;
  price: number; // halalat (100 = 1 SAR)
  duration: number; // minutes
  isActive: boolean;
  isHidden: boolean;
  hidePriceOnBooking: boolean;
  hideDurationOnBooking: boolean;
  bufferMinutes: number;
  depositEnabled: boolean;
  depositPercent: number | null;
  allowRecurring: boolean;
  allowedRecurringPatterns: string[];
  maxRecurrences: number | null;
  maxParticipants: number;
  minLeadMinutes: number | null;
  maxAdvanceDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceWithCategory extends Service {
  category: ServiceCategory;
}

export interface ServiceDurationOption {
  id: string;
  serviceId: string;
  label: string;
  labelAr: string | null;
  durationMinutes: number;
  price: number; // halalat
  isDefault: boolean;
  sortOrder: number;
}

export interface ServiceBookingType {
  id: string;
  serviceId: string;
  bookingType: 'in_person' | 'online';
  price: number; // halalat
  duration: number; // minutes
  isActive: boolean;
  durationOptions: ServiceDurationOption[];
}
