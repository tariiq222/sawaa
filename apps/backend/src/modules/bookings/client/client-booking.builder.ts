import type { Booking, Branch, Employee, Invoice, Payment, Service } from '@prisma/client';
import { mapBookingRow, type BookingRelations } from '../booking-row.mapper';
import type { ClientBookingDto } from './client-booking.dto';

/** Casing of the enum-valued fields (`status`, `deliveryType`) on the wire. */
export type ClientBookingEnumCase = 'upper' | 'lower';

export type ClientBookingInvoice = Invoice & { payments: Payment[] };

export interface ClientBookingContext {
  employee?: Employee | null;
  service?: Service | null;
  branch?: Branch | null;
  /** Invoice with its payments ordered newest first. */
  invoice?: ClientBookingInvoice | null;
  hasRated?: boolean;
  /** Web keeps the Prisma enum casing; the shipped mobile builds read lower-case. */
  enumCase?: ClientBookingEnumCase;
}

const cased = (value: string, enumCase: ClientBookingEnumCase) =>
  enumCase === 'lower' ? value.toLowerCase() : value.toUpperCase();

/**
 * Build the canonical client booking read model from a booking row it already
 * owns (ownership is enforced by the caller's Prisma `where`). The client-safe
 * subset of `mapBookingRow` is picked explicitly so staff-only fields can never
 * leak by being added to the mapper later.
 */
export function buildClientBooking(b: Booking, ctx: ClientBookingContext = {}): ClientBookingDto {
  const { employee = null, service = null, branch = null, invoice = null, hasRated = false, enumCase = 'upper' } = ctx;
  const latestPayment = invoice?.payments[0] ?? null;

  const paidHalalas = (invoice?.payments ?? [])
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Math.round(Number(p.amount)), 0);
  const invoiceTotal = invoice ? Math.round(Number(invoice.total)) : 0;

  const relations: BookingRelations = {
    clientsById: new Map(),
    employeesById: new Map(employee ? [[employee.id, employee]] : []),
    servicesById: new Map(service ? [[service.id, service]] : []),
    paymentsByBookingId: new Map(latestPayment ? [[b.id, {
      id: latestPayment.id,
      amount: Math.round(Number(latestPayment.amount)),
      refundedAmount: Math.round(Number(latestPayment.refundedAmount)),
      method: latestPayment.method as string,
      status: latestPayment.status as string,
    }]] : []),
    invoicesByBookingId: new Map(invoice ? [[b.id, {
      id: invoice.id,
      subtotal: Math.round(Number(invoice.subtotal)),
      vatRate: Number(invoice.vatRate),
      total: invoiceTotal,
      outstanding: Math.max(0, invoiceTotal - paidHalalas),
      status: invoice.status as string,
    }]] : []),
  };
  // Host URLs stay stripped (P0-6): includeHostUrls is deliberately not set.
  const m = mapBookingRow(b, relations);

  return {
    id: b.id,
    bookingNumber: m.bookingNumber,
    status: cased(b.status, enumCase),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    checkedInAt: m.checkedInAt,
    confirmedAt: m.confirmedAt,
    completedAt: m.completedAt,
    noShowAt: m.noShowAt,
    cancelledAt: m.cancelledAt,
    // Late-entry rows carry reception-authored cancel notes; never expose them.
    cancellationReason: b.lateEntryRecordedAt ? null : (b.cancelReason ?? null),

    scheduledAt: m.scheduledAt as string,
    endsAt: m.endsAt,
    date: m.date,
    startTime: m.startTime,
    endTime: m.endTime,
    durationMins: b.durationMins,
    durationMinutesSnapshot: m.durationMinutesSnapshot,

    price: b.price.toString(),
    priceSnapshot: m.priceSnapshot,
    currency: b.currency,
    payAtClinic: m.payAtClinic,
    paymentStatus: latestPayment?.status ?? null,
    invoiceId: invoice?.id ?? null,
    invoiceStatus: invoice?.status ?? null,
    payment: m.payment
      ? { id: m.payment.id, amount: m.payment.amount, totalAmount: m.payment.totalAmount, method: m.payment.method, status: m.payment.status }
      : null,
    invoice: m.invoice,

    deliveryType: cased(b.deliveryType, enumCase),
    bookingType: String(b.bookingType).toLowerCase(),
    type: m.type,
    categoryNameSnapshot: m.categoryNameSnapshot,
    branchNameSnapshot: m.branchNameSnapshot,

    serviceId: b.serviceId ?? null,
    // Fall back to the snapshot captured at booking time so a later hard-delete
    // of the service/employee/branch does not blank the name.
    serviceName: service?.nameEn ?? service?.nameAr ?? b.serviceNameSnapshot ?? '',
    serviceNameAr: service?.nameAr ?? b.serviceNameSnapshot ?? null,
    service: m.service,
    employeeId: b.employeeId,
    employeeName: employee?.name ?? b.employeeNameSnapshot ?? '',
    employeeNameAr: employee?.nameAr ?? b.employeeNameSnapshot ?? null,
    employee: m.employee && employee
      ? {
          id: m.employee.id,
          nameAr: employee.nameAr ?? null,
          nameEn: employee.name ?? null,
          avatarUrl: employee.avatarUrl ?? null,
          user: m.employee.user,
          specialty: m.employee.specialty,
          specialtyAr: m.employee.specialtyAr,
        }
      : null,
    branchId: b.branchId,
    branchName: branch?.nameEn ?? branch?.nameAr ?? b.branchNameSnapshot ?? '',
    branchNameAr: branch?.nameAr ?? b.branchNameSnapshot ?? null,
    branch: branch
      ? { id: branch.id, nameAr: branch.nameAr ?? null, nameEn: branch.nameEn ?? null }
      : null,

    zoomJoinUrl: b.zoomJoinUrl ?? null,
    zoomStartUrl: m.zoomStartUrl,
    zoomHostUrl: m.zoomHostUrl,
    zoomMeetingStatus: m.zoomMeetingStatus,

    hasRated,
  };
}
