import {
  BookingSource,
  BookingStatus,
  BookingType,
  DeliveryType,
  Prisma,
  type Booking,
} from '@prisma/client';

const SCHEDULED_AT = '2030-01-15T10:00:00.000Z';
const CREATED_AT = '2029-12-01T09:00:00.000Z';

/**
 * Valid `Booking` row with deterministic defaults.
 * Prices are integer halalas, matching the schema contract.
 */
export function buildBooking(overrides: Partial<Booking> = {}): Booking {
  const scheduledAt = new Date(SCHEDULED_AT);
  const createdAt = new Date(CREATED_AT);
  return {
    id: 'booking-1',
    branchId: 'branch-1',
    clientId: 'client-1',
    employeeId: 'employee-1',
    serviceId: 'service-1',
    bookingType: BookingType.INDIVIDUAL,
    deliveryType: DeliveryType.IN_PERSON,
    source: BookingSource.RECEPTION,
    creationIdempotencyKey: null,
    creationRequestHash: null,
    status: BookingStatus.PENDING,
    isHistoricalImport: false,
    lateEntryRecordedAt: null,
    lateEntryRecordedBy: null,
    scheduledAt,
    endsAt: new Date(scheduledAt.getTime() + 60 * 60_000),
    durationMins: 60,
    price: new Prisma.Decimal(15_000),
    currency: 'SAR',
    notes: null,
    cancelReason: null,
    cancelNotes: null,
    cancelledAt: null,
    confirmedAt: null,
    checkedInAt: null,
    autoNoShowSuppressedAt: null,
    completedAt: null,
    noShowAt: null,
    expiresAt: null,
    durationOptionId: null,
    programId: null,
    packageCreditId: null,
    payAtClinic: false,
    couponCode: null,
    discountedPrice: null,
    zoomMeetingId: null,
    zoomJoinUrl: null,
    zoomHostUrl: null,
    zoomStartUrl: null,
    zoomMeetingStatus: null,
    zoomMeetingError: null,
    zoomMeetingCreatedAt: null,
    zoomCreatePhase: 'BEFORE_CALL',
    zoomCreateLeaseOwner: null,
    zoomCreateLeaseExpiresAt: null,
    zoomCreateAttemptCount: 0,
    zoomSyncRevision: 0,
    zoomSyncLeaseOwner: null,
    zoomSyncLeaseExpiresAt: null,
    priceSnapshot: null,
    durationMinutesSnapshot: null,
    branchNameSnapshot: null,
    employeeNameSnapshot: null,
    serviceNameSnapshot: null,
    categoryNameSnapshot: null,
    departmentNameSnapshot: null,
    bookingNumber: 1,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}
