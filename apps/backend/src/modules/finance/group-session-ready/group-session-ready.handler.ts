import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceHandler } from '../create-invoice/create-invoice.handler';

interface GroupSessionMinReachedPayload {
  serviceId: string;
  groupSessionKey: string;
  bookingIds: string[];
}

export interface GroupSessionPaymentLink {
  bookingId: string;
  clientId: string;
  invoiceId: string;
  amount: number;
  currency: string;
}

/**
 * Subscribes to group_session.min_reached.
 *
 * For each booking in AWAITING_PAYMENT:
 *   1. Creates an invoice (idempotent — skips if already exists)
 *   2. Collects the invoice id + amount for the notification payload
 *
 * Emits group_session.payment_links_ready so the comms module can send
 * a payment link to each client.
 */
@Injectable()
export class GroupSessionReadyHandler {
  private readonly logger = new Logger(GroupSessionReadyHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly createInvoice: CreateInvoiceHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<GroupSessionMinReachedPayload>(
      'group_session.min_reached',
      async (envelope) => {
        const { bookingIds, groupSessionKey } = envelope.payload;
        try {
          await this.handleMinReached(bookingIds, groupSessionKey);
        } catch (err) {
          this.logger.error(
            `GroupSessionReadyHandler failed for key ${groupSessionKey}`,
            err,
          );
          throw err;
        }
      },
    );
  }

  async handleMinReached(
    bookingIds: string[],
    groupSessionKey: string,
  ): Promise<void> {
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        clientId: true,
        employeeId: true,
        branchId: true,
        price: true,
        discountedPrice: true,
        currency: true,
      },
    });

    const paymentLinks: GroupSessionPaymentLink[] = [];

    for (const booking of bookings) {
      const subtotal = Number(booking.discountedPrice ?? booking.price);

      let invoice;
      try {
        invoice = await this.createInvoice.execute({
          branchId: booking.branchId,
          clientId: booking.clientId,
          employeeId: booking.employeeId,
          bookingId: booking.id,
          subtotal,
        });
      } catch (err) {
        // ConflictException (409) = invoice already exists — fetch it
        if ((err as { status?: number }).status === 409) {
          invoice = await this.prisma.invoice.findFirst({
            where: { bookingId: booking.id },
          });
        } else {
          throw err;
        }
      }

      if (invoice) {
        paymentLinks.push({
          bookingId: booking.id,
          clientId: booking.clientId,
          invoiceId: invoice.id,
          amount: subtotal,
          currency: booking.currency,
        });
      }
    }

    if (paymentLinks.length > 0) {
      await this.eventBus.publish('group_session.payment_links_ready', {
        eventId: randomUUID(),
        source: 'finance',
        version: 1,
        occurredAt: new Date(),
        payload: { groupSessionKey, paymentLinks },
      });
    }
  }
}
