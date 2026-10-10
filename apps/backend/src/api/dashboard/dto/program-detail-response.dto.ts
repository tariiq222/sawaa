import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus, ProgramStatus } from '@prisma/client';

export class ProgramSupervisorResponseDto {
  @ApiProperty({ format: 'uuid', description: "Program supervisor employee identifier", example: "33333333-3333-4333-8333-333333333333" }) id!: string;
  @ApiProperty({ description: "Program supervisor display name in the default language", example: "أخصائي البرامج" }) name!: string;
  @ApiProperty({ type: String, nullable: true, description: "English supervisor display name, or null when unavailable", example: "Program Counselor" }) nameEn!: string | null;
}
export class ProgramEnrollmentBookingResponseDto {
  @ApiProperty({ format: 'uuid', description: "Booking identifier associated with this enrollment", example: "44444444-4444-4444-8444-444444444444" }) id!: string;
  @ApiProperty({ format: 'uuid', description: "Client identifier associated with the booking", example: "22222222-2222-4222-8222-222222222222" }) clientId!: string;
  @ApiProperty({ enum: BookingStatus, description: "Current booking lifecycle status", example: "CONFIRMED" }) status!: BookingStatus;
  @ApiProperty({ description: 'Price in halalas, serialized as a decimal string', example: "150000" }) price!: string;
  @ApiProperty({ description: "Booking price currency code", example: "SAR" }) currency!: string;
  @ApiProperty({ type: String, format: 'date-time', description: "Scheduled booking time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) scheduledAt!: Date;
  @ApiProperty({ description: "Numeric reference of the associated booking", example: 1024 }) bookingNumber!: number;
}
export class ProgramEnrollmentResponseDto {
  @ApiProperty({ format: 'uuid', description: "Program enrollment identifier", example: "99999999-9999-4999-8999-999999999999" }) id!: string;
  @ApiProperty({ format: 'uuid', description: "Enrolled client identifier", example: "22222222-2222-4222-8222-222222222222" }) clientId!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Current client display name, or null if unavailable', example: "عميل تجريبي" }) clientName!: string | null;
  @ApiProperty({ type: String, format: 'date-time', description: "Enrollment creation time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) enrolledAt!: Date;
  @ApiProperty({ type: ProgramEnrollmentBookingResponseDto, description: "Booking associated with the enrollment", example: {"id": "44444444-4444-4444-8444-444444444444", "clientId": "22222222-2222-4222-8222-222222222222", "status": "CONFIRMED", "price": "150000", "currency": "SAR", "scheduledAt": "2026-10-10T09:00:00.000Z", "bookingNumber": 1024} }) booking!: ProgramEnrollmentBookingResponseDto;
}
export class ProgramDetailResponseDto {
  @ApiProperty({ format: 'uuid', description: "Unique program identifier", example: "66666666-6666-4666-8666-666666666666" }) id!: string;
  @ApiProperty({ description: "Numeric program reference accepted by the program detail lookup", example: 24 }) ref!: number;
  @ApiProperty({ format: 'uuid', description: "Department that owns the program", example: "77777777-7777-4777-8777-777777777777" }) departmentId!: string;
  @ApiProperty({ format: 'uuid', description: "Branch where the program is offered", example: "88888888-8888-4888-8888-888888888888" }) branchId!: string;
  @ApiProperty({ description: "Arabic program name", example: "برنامج التواصل الأسري" }) nameAr!: string;
  @ApiProperty({ type: String, nullable: true, description: "English program name, or null when unspecified", example: "Family Communication Program" }) nameEn!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "Arabic staff-facing program description, or null when unspecified", example: "برنامج لتنمية مهارات التواصل الأسري" }) descriptionAr!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "English staff-facing program description, or null when unspecified", example: "A program for family communication skills" }) descriptionEn!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: "Program start time as an ISO 8601 UTC timestamp, or null when unscheduled", example: null }) startDate!: Date | null;
  @ApiProperty({ description: "Number of program days", example: 3 }) daysCount!: number;
  @ApiProperty({ description: "Number of program hours per day", example: 2 }) hoursPerDay!: number;
  @ApiProperty({ description: "Minimum participants required for the program", example: 3 }) minParticipants!: number;
  @ApiProperty({ description: "Maximum number of enrolled participants", example: 12 }) maxParticipants!: number;
  @ApiProperty({ description: "Current number of program enrollments", example: 1 }) enrolledCount!: number;
  @ApiProperty({ description: 'Price in halalas, serialized as a decimal string', example: "150000" }) price!: string;
  @ApiProperty({ description: "Program price currency code", example: "SAR" }) currency!: string;
  @ApiProperty({ description: "Whether the program accepts a deposit", example: true }) depositEnabled!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Deposit in halalas, serialized as a decimal string', example: "30000" }) depositAmount!: string | null;
  @ApiProperty({ enum: ProgramStatus, description: "Current program lifecycle status", example: "OPEN" }) status!: ProgramStatus;
  @ApiProperty({ description: "Whether the program is published in the public catalog", example: true }) isPublic!: boolean;
  @ApiProperty({ type: String, nullable: true, description: "Arabic public catalog description, or null when unspecified", example: "تعرف على مهارات التواصل الأسري" }) publicDescriptionAr!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "English public catalog description, or null when unspecified", example: "Learn family communication skills" }) publicDescriptionEn!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "Recorded cancellation reason, or null for a program without a reason", example: null }) cancelReason!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: "Cancellation time as an ISO 8601 UTC timestamp, or null when not cancelled", example: null }) cancelledAt!: Date | null;
  @ApiProperty({ type: String, format: 'date-time', description: "Program creation time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: "Most recent program update time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) updatedAt!: Date;
  @ApiProperty({ type: [String], description: "Identifiers of employees supervising the program", example: ["33333333-3333-4333-8333-333333333333"] }) supervisorIds!: string[];
  @ApiProperty({ type: [ProgramSupervisorResponseDto], description: "Display details of the program supervisors", example: [{"id": "33333333-3333-4333-8333-333333333333", "name": "أخصائي البرامج", "nameEn": "Program Counselor"}] }) supervisors!: ProgramSupervisorResponseDto[];
  @ApiProperty({ description: "Whether enrolled count has reached the maximum participant capacity", example: false }) isFull!: boolean;
  @ApiProperty({ type: [ProgramEnrollmentResponseDto], description: "Enrollments and their associated clients and bookings", example: [{"id": "99999999-9999-4999-8999-999999999999", "clientId": "22222222-2222-4222-8222-222222222222", "clientName": "عميل تجريبي", "enrolledAt": "2026-10-10T09:00:00.000Z", "booking": {"id": "44444444-4444-4444-8444-444444444444", "clientId": "22222222-2222-4222-8222-222222222222", "status": "CONFIRMED", "price": "150000", "currency": "SAR", "scheduledAt": "2026-10-10T09:00:00.000Z", "bookingNumber": 1024}}] }) enrollments!: ProgramEnrollmentResponseDto[];
}
