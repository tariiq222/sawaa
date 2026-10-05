import { Booking, Prisma } from "@prisma/client";
import { mapBookingRow } from "../booking-row.mapper";
export async function lateSessionResult(
  tx: Prisma.TransactionClient,
  booking: Booking,
) {
  const [client, employee, service, invoice] = await Promise.all([
    tx.client.findUnique({ where: { id: booking.clientId } }),
    tx.employee.findUnique({ where: { id: booking.employeeId } }),
    booking.serviceId
      ? tx.service.findUnique({ where: { id: booking.serviceId } })
      : null,
    tx.invoice.findUnique({ where: { bookingId: booking.id } }),
  ]);
  const payments = invoice
    ? await tx.payment.findMany({
        where: { invoiceId: invoice.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const paid = payments
    .filter((p) =>
      ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status),
    )
    .reduce((n, p) => n + Number(p.amount), 0);
  const outstanding = invoice ? Math.max(0, Number(invoice.total) - paid) : 0;
  const payment = payments[0] ?? null;
  const invoiceSummary = invoice
    ? {
        id: invoice.id,
        subtotal: Number(invoice.subtotal),
        vatRate: Number(invoice.vatRate),
        total: Number(invoice.total),
        outstanding,
        status: invoice.status,
      }
    : null;
  return {
    booking: mapBookingRow(booking, {
      clientsById: new Map(client ? [[client.id, client]] : []),
      employeesById: new Map(employee ? [[employee.id, employee]] : []),
      servicesById: new Map(service ? [[service.id, service]] : []),
      paymentsByBookingId: new Map(
        payment
          ? [
              [
                booking.id,
                {
                  id: payment.id,
                  amount: Number(payment.amount),
                  refundedAmount: Number(payment.refundedAmount ?? 0),
                  method: payment.method,
                  status: payment.status,
                  effectiveReceivedAt: payment.effectiveReceivedAt,
                  createdAt: payment.createdAt,
                  processedAt: payment.processedAt,
                  receiptRecordedBy: payment.receiptRecordedBy,
                  receiptEvidenceRef: payment.receiptEvidenceRef,
                  receiptEntryReason: payment.receiptEntryReason,
                },
              ],
            ]
          : [],
      ),
      invoicesByBookingId: new Map(
        invoiceSummary ? [[booking.id, invoiceSummary]] : [],
      ),
    }),
    invoice: invoice
      ? {
          ...invoice,
          subtotal: Number(invoice.subtotal),
          discountAmt: Number(invoice.discountAmt),
          vatRate: Number(invoice.vatRate),
          vatAmt: Number(invoice.vatAmt),
          total: Number(invoice.total),
          outstanding,
        }
      : null,
    payment: payment
      ? {
          ...payment,
          amount: Number(payment.amount),
          collectionDate: (
            payment.effectiveReceivedAt ?? payment.createdAt
          ).toISOString(),
        }
      : null,
    outstanding,
    isLateEntry: true as const,
    lateEntryRecordedAt: booking.lateEntryRecordedAt!.toISOString(),
    lateEntryRecordedBy: booking.lateEntryRecordedBy!,
  };
}
