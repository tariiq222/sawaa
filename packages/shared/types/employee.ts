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
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
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
