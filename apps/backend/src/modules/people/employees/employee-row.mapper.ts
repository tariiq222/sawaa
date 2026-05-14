import type { Employee, EmployeeBranch, EmployeeService, EmployeeAvailability } from '@prisma/client';

type EmployeeWithRelations = Employee & {
  branches?: EmployeeBranch[];
  services?: EmployeeService[];
  availability?: EmployeeAvailability[];
};

export interface EmployeeListItem {
  id: string;
  userId: string | null;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  phone: string | null;
  email: string | null;
  gender: Employee['gender'];
  avatarUrl: string | null;
  bio: string | null;
  bioAr: string | null;
  education: string | null;
  educationAr: string | null;
  experience: number | null;
  employmentType: Employee['employmentType'];
  onboardingStatus: Employee['onboardingStatus'];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branchIds: string[];
  serviceIds: string[];
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
  averageRating: number | null;
  ratingCount: number;
  bookingCount: number;
}

export interface EmployeeRatingAggregate {
  avg: number | null;
  count: number;
}

export function mapEmployeeRow(
  e: EmployeeWithRelations,
  ratings: EmployeeRatingAggregate = { avg: null, count: 0 },
  bookingCount = 0,
): EmployeeListItem {
  return {
    id: e.id,
    userId: e.userId,
    name: e.name,
    nameAr: e.nameAr,
    nameEn: e.nameEn,
    title: e.title,
    specialty: e.specialty,
    specialtyAr: e.specialtyAr,
    phone: e.phone,
    email: e.email,
    gender: e.gender,
    avatarUrl: e.avatarUrl,
    bio: e.bio,
    bioAr: e.bioAr,
    education: e.education,
    educationAr: e.educationAr,
    experience: e.experience,
    employmentType: e.employmentType,
    onboardingStatus: e.onboardingStatus,
    isActive: e.isActive,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    branchIds: (e.branches ?? []).map((b) => b.branchId),
    serviceIds: (e.services ?? []).map((s) => s.serviceId),
    availability: (e.availability ?? []).map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      isActive: a.isActive,
    })),
    averageRating: ratings.avg,
    ratingCount: ratings.count,
    bookingCount,
  };
}
