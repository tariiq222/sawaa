/**
 * Program types — single source of truth for the frontend
 * (lib/types/program.ts).
 *
 * Hand-maintained, NOT generated from OpenAPI. The shape mirrors the
 * backend response from /api/v1/dashboard/programs and
 * /api/v1/public/programs.
 */

export type ProgramStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'MIN_REACHED'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProgramSummary {
  id: string;
  ref: number;
  nameAr: string;
  nameEn: string | null;
  departmentId: string;
  branchId: string;
  startDate: string | null;
  daysCount: number;
  hoursPerDay: number;
  minParticipants: number;
  maxParticipants: number;
  enrolledCount: number;
  price: string;
  currency: string;
  depositEnabled: boolean;
  depositAmount: string | null;
  status: ProgramStatus;
  isPublic: boolean;
  cancelledAt: string | null;
  createdAt: string;
  supervisorIds: string[];
  isFull: boolean;
  enrollmentCount?: number;
}

export interface ProgramEnrollmentSummary {
  id: string;
  clientId: string;
  enrolledAt: string;
  booking: {
    id: string;
    clientId: string;
    status: string;
    price: string;
    currency: string;
    scheduledAt: string;
    bookingNumber: number;
  };
}

export interface ProgramDetail extends ProgramSummary {
  descriptionAr: string | null;
  descriptionEn: string | null;
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  cancelReason: string | null;
  updatedAt: string;
  enrollments: ProgramEnrollmentSummary[];
}

export interface PublicProgramListItem {
  id: string;
  ref: number;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  departmentId: string;
  branchId: string;
  startDate: string | null;
  daysCount: number;
  hoursPerDay: number;
  minParticipants: number;
  maxParticipants: number;
  enrolledCount: number;
  price: string;
  currency: string;
  depositEnabled: boolean;
  depositAmount: string | null;
  status: ProgramStatus;
  isPublic: boolean;
  supervisorIds: string[];
  isFull: boolean;
  isOpenForEnrollment?: boolean;
}

export interface ListProgramsQuery {
  status?: ProgramStatus;
  departmentId?: string;
  branchId?: string;
}

export interface CreateProgramPayload {
  departmentId: string;
  branchId: string;
  nameAr: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  daysCount: number;
  hoursPerDay: number;
  minParticipants: number;
  maxParticipants: number;
  /** Whole halalas. */
  price: number;
  currency?: string;
  depositEnabled?: boolean;
  depositAmount?: number;
  isPublic?: boolean;
  publicDescriptionAr?: string;
  publicDescriptionEn?: string;
  supervisorIds: string[];
}

export interface ScheduleProgramPayload {
  startDate: string;
}

export interface CancelProgramPayload {
  reason: string;
}

export interface EnrollInProgramPayload {
  programId: string;
  clientId: string;
}

export interface EnrollInProgramResult {
  type: 'ENROLLED';
  bookingId: string;
  status: string;
  invoiceId: string | null;
}
