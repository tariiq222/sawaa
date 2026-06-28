import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateInvoiceHandler } from '../create-invoice/create-invoice.handler';
import { decimalToHalalas } from '../money.helper';

export interface EnsureBookingInvoiceCommand {
  bookingId: string;
}

export interface EnsureBookingInvoiceResult {
  id: string;
  subtotal: number;
  vatRate: number;
  total: number;
  outstanding: number;
  status: string;
}

/**
 * Lazily materialise a DRAFT invoice for a booking at the moment reception
 * records the first payment. Pay-at-clinic bookings carry no invoice until
 * the appointment is completed (create-booking skips it); this lets staff
 * collect an upfront/cash payment by creating the invoice on demand instead
 * of forcing every confirmed booking to spawn a DRAFT invoice up front.
 *
 * Idempotent: if an invoice already exists it is returned untouched.
 */
@Injectable()
export class EnsureBookingInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createInvoice: CreateInvoiceHandler,
  ) {}

  async execute(cmd: EnsureBookingInvoiceCommand): Promise<EnsureBookingInvoiceResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: cmd.bookingId },
      select: {
        id: true,
        branchId: true,
        clientId: true,
        employeeId: true,
        price: true,
        discountedPrice: true,
      },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    // Existing invoice — return its current shape (idempotent).
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    });
    if (existingInvoice) {
      return this.shape(existingInvoice.id);
    }

    if (!booking.clientId) {
      throw new BadRequestException('Cannot invoice a guest booking without a client');
    }

    const subtotal = decimalToHalalas(booking.price);
    if (subtotal <= 0) {
      throw new BadRequestException('Booking has no payable amount');
    }
    const discountAmt =
      booking.discountedPrice !== null && booking.discountedPrice !== undefined
        ? subtotal - decimalToHalalas(booking.discountedPrice)
        : undefined;

    try {
      const invoice = await this.createInvoice.execute({
        branchId: booking.branchId,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        bookingId: booking.id,
        subtotal,
        discountAmt,
      });
      return this.shape(invoice.id);
    } catch (err) {
      // Concurrent create raced us — the invoice now exists. Fetch and return it.
      if ((err as { status?: number }).status === 409) {
        const existing = await this.prisma.invoice.findUnique({
          where: { bookingId: booking.id },
          select: { id: true },
        });
        if (existing) return this.shape(existing.id);
      }
      throw err;
    }
  }

  /** Return the dashboard-facing invoice shape with computed outstanding. */
  private async shape(invoiceId: string): Promise<EnsureBookingInvoiceResult> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { id: true, subtotal: true, vatRate: true, total: true, status: true },
    });
    const paid = await this.prisma.payment.aggregate({
      where: { invoiceId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const total = decimalToHalalas(invoice.total);
    const outstanding = total - Number(paid._sum?.amount ?? 0);
    return {
      id: invoice.id,
      subtotal: decimalToHalalas(invoice.subtotal),
      vatRate: Number(invoice.vatRate),
      total,
      outstanding,
      status: invoice.status,
    };
  }
}
