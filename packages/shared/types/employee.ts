export interface Employee {
  id: string;
  userId: string;
  specialty: string | null;
  specialtyAr: string | null;
  bio: string | null;
  bioAr: string | null;
  experience: number;
  education: string | null;
  educationAr: string | null;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface EmployeeServicePricing {
  id: string;
  employeeId: string;
  serviceId: string;
  customDuration: number | null;
  bufferMinutes: number;
  availableTypes: ('in_person' | 'online' | 'walk_in')[];
  isActive: boolean;
  service?: {
    id: string;
    nameAr: string;
    nameEn: string;
  };
}

export interface EmployeeWithUser extends Employee {
  /** Arabic display name — public endpoint includes it at the top level. */
  nameAr?: string | null;
  /** English display name — shown on the website when locale is EN. */
  nameEn?: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  /** Service ids the employee is configured to deliver. Public list endpoint includes this. */
  serviceIds?: string[];
  /** Branch ids the employee works from. Public list endpoint includes this. */
  branchIds?: string[];
  /** Whether the employee has services + branches + availability configured. */
  isBookable?: boolean;
  /** Days of week (0=Sun..6=Sat) the employee has at least one active availability rule on. */
  availableDaysOfWeek?: number[];
}

export interface EmployeeAvailability {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface EmployeeVacation {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}
