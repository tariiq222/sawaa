import type { Booking, Client, Employee, Service } from '@prisma/client';
import { formatToBusinessHHmm, formatToBusinessYmd } from '../../common/timezone';

/** One representative payment per booking (latest). Amounts in halalat. */
export interface BookingPaymentRelation {
  id: string;
  amount: number;       // halalas (Payment.amount is stored in halalas)
  refundedAmount: number; // halalat
  method: string;       // Prisma PaymentMethod enum string
  status: string;       // Prisma PaymentStatus enum string
}

/** Invoice summary per booking (amounts in halalat). */
export interface BookingInvoiceRelation {
  id: string;
  subtotal: number;    // net before VAT/discount (halalas)
  vatRate: number;     // fractional rate, e.g. 0
  total: number;       // gross total after discount (halalas)
  outstanding: number; // total minus completed payments (halalas)
  status: string;      // Prisma InvoiceStatus enum string
}

export interface BookingRelations {
  clientsById: Map<string, Client>;
  employeesById: Map<string, Employee>;
  servicesById: Map<string, Service>;
  /** bookingId → latest payment (in halalat). Absent key means no payment. */
  paymentsByBookingId: Map<string, BookingPaymentRelation>;
  /** bookingId → invoice summary. Absent key means no invoice yet. */
  invoicesByBookingId?: Map<string, BookingInvoiceRelation>;
}

/**
 * Normalize a Prisma Booking row + its eagerly-loaded (by id) relations into
 * the shape the dashboard expects:
 *   - lowercase `type` (enum snake_case)
 *   - `date` + `startTime` + `endTime` derived from scheduledAt / endsAt (UTC)
 *   - nested `client / employee.user / service / payment`
 *
 * Booking lives in its own bounded context; `client / employee / service` are
 * loaded separately and passed in via `relations` — there is no Prisma relation.
 */
export interface MapBookingRowOptions {
  /**
   * SECURITY (P0-6): Zoom `zoomHostUrl` and `zoomStartUrl` grant host privileges
   * (no auth, just a token in the URL). They must NEVER appear in list/read
   * responses for booking-staff. Only a verified host (e.g. the assigned
   * employee, via a dedicated "start meeting" endpoint) should ever see them.
   * Default: strip both fields. Set to `true` only from a path that has
   * already verified the caller is the meeting host.
   */
  includeHostUrls?: boolean;
}

export function mapBookingRow(b: Booking, relations: BookingRelations, opts: MapBookingRowOptions = {}) {
  const client = relations.clientsById.get(b.clientId) ?? null;
  const employee = relations.employeesById.get(b.employeeId) ?? null;
  const service = b.serviceId ? (relations.servicesById.get(b.serviceId) ?? null) : null;

  const scheduled = b.scheduledAt;
  const ends = b.endsAt;

  // Convert UTC instants to Asia/Riyadh wall-clock for display.
  // Using formatToBusinessYmd/HHmm (date-fns-tz) ensures the output is
  // correct regardless of the server's process TZ.
  const date = formatToBusinessYmd(scheduled);
  const startTime = formatToBusinessHHmm(scheduled);
  const endTime = formatToBusinessHHmm(ends);

  const clientNames = splitName(client?.name ?? null, client?.firstName ?? null, client?.lastName ?? null);
  const employeeNames = splitName(employee?.nameAr || employee?.name || null, null, null);

  const pay = relations.paymentsByBookingId.get(b.id) ?? null;
  const inv = relations.invoicesByBookingId?.get(b.id) ?? null;

  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    clientId: b.clientId,
    employeeId: b.employeeId,
    serviceId: b.serviceId,
    employeeServiceId: '',
    type: mapTypeForUi(b.bookingType),
    deliveryType: mapDeliveryTypeForUi(b.deliveryType),
    source: b.source,
    categoryNameSnapshot: b.categoryNameSnapshot ?? null,
    branchNameSnapshot: b.branchNameSnapshot ?? null,
    durationMinutesSnapshot: b.durationMinutesSnapshot ?? null,
    priceSnapshot: b.priceSnapshot != null ? Number(b.priceSnapshot) : null,
    date,
    startTime,
    endTime,
    status: mapStatusForUi(b.status),
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    notes: b.notes ?? null,
    zoomJoinUrl: b.zoomJoinUrl ?? null,
    // P0-6: host URLs stripped by default. See MapBookingRowOptions.
    zoomHostUrl: opts.includeHostUrls ? (b.zoomHostUrl ?? null) : null,
    zoomStartUrl: opts.includeHostUrls ? (b.zoomStartUrl ?? null) : null,
    zoomMeetingStatus: b.zoomMeetingStatus ?? null,
    zoomMeetingError: b.zoomMeetingError ?? null,
    cancellationReason: b.cancelReason ?? null,
    cancelledBy: null,
    suggestedRefundType: null,
    adminNotes: null,
    cancelledAt: b.cancelledAt?.toISOString() ?? null,
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    completedAt: b.completedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    client: client
      ? {
          id: client.id,
          firstName: clientNames.first,
          lastName: clientNames.last,
          email: client.email ?? '',
          phone: client.phone ?? null,
        }
      : null,
    employee: employee
      ? {
          id: employee.id,
          userId: employee.userId ?? '',
          user: { firstName: employeeNames.first, lastName: employeeNames.last },
          specialty: employee.specialty ?? '',
          specialtyAr: employee.specialtyAr ?? '',
        }
      : null,
    service: service
      ? {
          id: service.id,
          nameAr: service.nameAr,
          nameEn: service.nameEn ?? '',
          price: Number(service.price),
          duration: service.durationMins,
        }
      : null,
    employeeService: null,
    rescheduledFrom: null,
    payment: pay
      ? {
          id: pay.id,
          amount: pay.amount,
          method: mapPaymentMethodForUi(pay.method),
          status: mapPaymentStatusForUi(pay.status),
          totalAmount: pay.amount,
        }
      : null,
    invoice: inv
      ? {
          id: inv.id,
          subtotal: inv.subtotal,
          vatRate: inv.vatRate,
          total: inv.total,
          outstanding: inv.outstanding,
          status: inv.status,
        }
      : null,
    intakeFormId: null,
    intakeFormAlreadySubmitted: false,
  };
}

/** DB DeliveryType enum → dashboard lowercase alias. */
function mapDeliveryTypeForUi(dt: string | null | undefined): string | null {
  if (!dt) return null;
  return dt.toLowerCase(); // IN_PERSON → in_person, ONLINE → online
}

/** DB BookingType → dashboard snake_case alias. INDIVIDUAL → in_person. */
function mapTypeForUi(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'individual') return 'in_person';
  return lower;
}

/** DB enum → dashboard BookingStatus union.
 * awaiting_payment and pending_group_fill are treated as `pending` for UX simplicity.
 * deposit_paid is a distinct, standalone state (service deposit paid, slot reserved,
 * a balance is still outstanding) — it is NOT folded into any other status.
 */
function mapStatusForUi(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'deposit_paid') return 'deposit_paid';
  if (lower === 'awaiting_payment' || lower === 'pending_group_fill') return 'pending';
  return lower;
}

type PaymentStatusUi = 'pending' | 'awaiting' | 'paid' | 'failed' | 'refunded' | 'rejected';

/**
 * Maps Prisma PaymentStatus enum → dashboard BookingPayment.status union.
 * Dashboard union: "pending" | "awaiting" | "paid" | "failed" | "refunded" | "rejected"
 */
export function mapPaymentStatusForUi(s: string): PaymentStatusUi {
  switch (s.toUpperCase()) {
    case 'PENDING': return 'pending';
    case 'PENDING_VERIFICATION': return 'awaiting';
    case 'COMPLETED': return 'paid';
    case 'FAILED': return 'failed';
    case 'PARTIALLY_REFUNDED': return 'refunded';
    case 'REFUNDED': return 'refunded';
    default: return 'pending';
  }
}

type PaymentMethodUi = 'moyasar' | 'bank_transfer' | 'cash';

/**
 * Maps Prisma PaymentMethod enum → dashboard BookingPayment.method union.
 * Prisma enum members: ONLINE_CARD, BANK_TRANSFER, CASH, COUPON
 * Dashboard union: "moyasar" | "bank_transfer" | "cash"
 */
export function mapPaymentMethodForUi(m: string): PaymentMethodUi {
  switch (m.toUpperCase()) {
    case 'ONLINE_CARD': return 'moyasar';
    case 'BANK_TRANSFER': return 'bank_transfer';
    case 'CASH': return 'cash';
    case 'COUPON': return 'cash'; // coupon-paid bookings treat method as cash for display
    default: return 'cash';
  }
}

function splitName(full: string | null, first: string | null, last: string | null) {
  if (first || last) return { first: first ?? '', last: last ?? '' };
  if (!full) return { first: '', last: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
