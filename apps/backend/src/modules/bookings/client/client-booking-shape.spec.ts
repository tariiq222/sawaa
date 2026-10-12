import { buildClientBooking } from './client-booking.builder';

/**
 * Compatibility proof for the unified client booking shape: every key the
 * shipped mobile builds and the website read must stay present (value may be
 * null), and staff-only keys must never appear.
 */

// apps/mobile/services/client/bookings.ts → ClientBookingRow
const MOBILE_ROW_KEYS = [
  'id', 'invoiceId', 'invoiceStatus', 'paymentStatus', 'price', 'currency',
  'serviceName', 'serviceNameAr', 'employeeName', 'employeeNameAr', 'branchName', 'branchNameAr',
  'scheduledAt', 'durationMins', 'status', 'hasRated', 'bookingType', 'type', 'deliveryType',
  'employeeId', 'employee', 'branchId', 'branch', 'serviceId', 'service',
  'zoomJoinUrl', 'zoomStartUrl', 'zoomMeetingStatus',
  // cancellationRefund is detail-only, asserted separately.
];
// Fields the mobile normalizer reads from the mapBookingRow wire shape.
const MOBILE_MAPPER_KEYS = [
  'date', 'startTime', 'invoice', 'payment', 'priceSnapshot', 'durationMinutesSnapshot',
  'branchNameSnapshot', 'categoryNameSnapshot',
];
const MOBILE_EMPLOYEE_KEYS = ['id', 'nameAr', 'nameEn', 'avatarUrl', 'user'];
const MOBILE_BRANCH_KEYS = ['id', 'nameAr', 'nameEn'];
const MOBILE_SERVICE_KEYS = ['id', 'nameAr', 'nameEn', 'price', 'duration'];

// packages/shared ClientBookingItem + booking-detail-feature.tsx reads.
const WEBSITE_KEYS = [
  'id', 'status', 'scheduledAt', 'endsAt', 'durationMins', 'price', 'currency',
  'serviceId', 'employeeId', 'branchId',
  'serviceName', 'serviceNameAr', 'employeeName', 'employeeNameAr', 'branchName', 'branchNameAr',
  'paymentStatus', 'createdAt', 'invoiceId', 'invoiceStatus', 'deliveryType', 'zoomJoinUrl',
];

const STAFF_ONLY_KEYS = [
  'notes', 'adminNotes', 'source', 'client', 'clientId', 'zoomMeetingError', 'lateEntryRecordedBy',
  'lateEntryRecordedAt', 'isLateEntry', 'isHistoricalImport', 'historicalPayment', 'packageFunding',
  'cancelledBy', 'suggestedRefundType', 'intakeFormId', 'rescheduledFrom', 'cancelNotes',
];

const row = {
  id: 'bk-1', bookingNumber: 12, clientId: 'cl-1', employeeId: 'emp-1', serviceId: 'svc-1', branchId: 'br-1',
  status: 'CONFIRMED', bookingType: 'INDIVIDUAL', deliveryType: 'ONLINE', source: 'RECEPTION',
  scheduledAt: new Date('2026-03-01T09:00:00Z'), endsAt: new Date('2026-03-01T10:00:00Z'),
  durationMins: 60, durationMinutesSnapshot: 60, price: 200, priceSnapshot: 200, currency: 'SAR',
  payAtClinic: false, categoryNameSnapshot: 'Family', branchNameSnapshot: 'Main',
  serviceNameSnapshot: 'Session', employeeNameSnapshot: 'Sara',
  zoomJoinUrl: 'https://zoom.us/j/1', zoomHostUrl: 'https://zoom.us/host', zoomStartUrl: 'https://zoom.us/start',
  zoomMeetingStatus: 'CREATED', zoomMeetingError: 'boom',
  notes: 'staff only', cancelReason: null, cancelNotes: 'reception wrote this',
  isHistoricalImport: true, lateEntryRecordedAt: null, lateEntryRecordedBy: 'staff-1',
  checkedInAt: null, confirmedAt: new Date('2026-02-01T00:00:00Z'), completedAt: null, noShowAt: null, cancelledAt: null,
  createdAt: new Date('2026-02-01T00:00:00Z'), updatedAt: new Date('2026-02-01T00:00:00Z'),
};
const employee = { id: 'emp-1', name: 'Sara', nameAr: 'سارة', userId: 'user-1', avatarUrl: null, specialty: 'CBT', specialtyAr: 'علاج' };
const service = { id: 'svc-1', nameEn: 'Session', nameAr: 'جلسة', price: 200, durationMins: 60 };
const branch = { id: 'br-1', nameEn: 'Main', nameAr: 'الرئيسي' };
const invoice = {
  id: 'inv-1', status: 'ISSUED', subtotal: 20000, vatRate: 0, total: 20000,
  payments: [{
    id: 'pay-1', status: 'PENDING', amount: 20000, refundedAmount: 0, method: 'ONLINE_CARD',
    receiptRecordedBy: 'staff-1', receiptEvidenceRef: 'ref', receiptEntryReason: 'reason',
  }],
};

const build = (enumCase: 'upper' | 'lower' = 'upper', withRelations = true) => buildClientBooking(
  row as never,
  withRelations
    ? { employee: employee as never, service: service as never, branch: branch as never, invoice: invoice as never, enumCase }
    : { enumCase },
) as unknown as Record<string, unknown>;

describe('ClientBookingDto compatibility', () => {
  it.each([['upper'], ['lower']] as const)('carries every mobile row key (%s enums)', (enumCase) => {
    const dto = build(enumCase);
    for (const key of [...MOBILE_ROW_KEYS, ...MOBILE_MAPPER_KEYS]) expect(dto).toHaveProperty(key);
  });

  it('carries every nested key the mobile normalizer reads', () => {
    const dto = build();
    for (const key of MOBILE_EMPLOYEE_KEYS) expect(dto.employee).toHaveProperty(key);
    for (const key of MOBILE_BRANCH_KEYS) expect(dto.branch).toHaveProperty(key);
    for (const key of MOBILE_SERVICE_KEYS) expect(dto.service).toHaveProperty(key);
    expect(dto.payment).toMatchObject({ status: 'pending' });
    expect(dto.invoice).toMatchObject({ id: 'inv-1', status: 'ISSUED' });
  });

  it('carries every website key', () => {
    const dto = build();
    for (const key of WEBSITE_KEYS) expect(dto).toHaveProperty(key);
  });

  it('keeps all keys present (null) when related rows and invoice are missing', () => {
    const dto = build('upper', false);
    for (const key of [...MOBILE_ROW_KEYS, ...MOBILE_MAPPER_KEYS, ...WEBSITE_KEYS]) expect(dto).toHaveProperty(key);
    expect(dto).toMatchObject({ employee: null, branch: null, service: null, payment: null, invoice: null, invoiceId: null, paymentStatus: null });
  });

  it('keeps host URLs null and never exposes staff-only fields', () => {
    const dto = build();
    expect(dto.zoomJoinUrl).toBe('https://zoom.us/j/1');
    expect(dto.zoomHostUrl).toBeNull();
    expect(dto.zoomStartUrl).toBeNull();
    for (const key of STAFF_ONLY_KEYS) expect(dto).not.toHaveProperty(key);
    expect(dto.employee).not.toHaveProperty('userId');
    expect(dto.payment).not.toHaveProperty('receiptRecordedBy');
    expect(JSON.stringify(dto)).not.toMatch(/host|start-secret|staff only|reception wrote/);
  });

  it('serves both alias names with the same values', () => {
    const dto = build();
    expect(dto.durationMins).toBe(dto.durationMinutesSnapshot);
    expect(Number(dto.price)).toBe(dto.priceSnapshot);
    expect(dto.bookingType).toBe('individual');
    expect(dto.type).toBe('in_person');
  });

  it('never leaks reception-authored cancel notes for late-entry rows', () => {
    const dto = buildClientBooking(
      { ...row, lateEntryRecordedAt: new Date(), cancelReason: 'CLIENT_REQUESTED' } as never,
    ) as unknown as Record<string, unknown>;
    expect(dto.cancellationReason).toBeNull();
  });
});
