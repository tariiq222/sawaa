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
  showPrice?: boolean;
  showDuration?: boolean;
  bufferMinutes: number;
  depositEnabled: boolean;
  depositPercent: number | null;
  maxParticipants: number;
  minLeadMinutes: number | null;
  maxAdvanceDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceWithCategory extends Service {
  category: ServiceCategory;
}

/**
 * Delivery channel — independent from BookingType.
 * IN_PERSON = physically at the branch; ONLINE = virtual (Zoom or other).
 */
export type DeliveryType = 'IN_PERSON' | 'ONLINE';

export interface ServiceDurationOption {
  id: string;
  serviceId: string;
  /** Legacy booking type — prefer deliveryType for new code */
  bookingType?: 'in_person' | 'online' | 'walk_in' | 'group';
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType?: DeliveryType;
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
  /** Legacy booking mode — prefer deliveryType for new code */
  bookingType: 'in_person' | 'online';
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType?: DeliveryType;
  price: number; // halalat
  duration: number; // minutes
  isActive: boolean;
  durationOptions: ServiceDurationOption[];
}
