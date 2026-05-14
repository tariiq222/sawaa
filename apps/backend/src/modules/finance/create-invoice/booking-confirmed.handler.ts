import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceHandler } from './create-invoice.handler';

interface BookingConfirmedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  branchId: string;
  price: number;        // emitted by BookingConfirmedEvent in bookings/
  currency: string;
}

/**
 * Subscribes to bookings.booking.confirmed events.
 * Creates an invoice automatically when a booking is confirmed.
 */
@Injectable()
export class BookingConfirmedHandler {
  private readonly logger = new Logger(BookingConfirmedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly createInvoice: CreateInvoiceHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingConfirmedPayload>(
      'bookings.booking.confirmed',
      async (envelope) => {
        const { bookingId, clientId, employeeId, branchId, price } =
          envelope.payload;
        try {
          await this.createInvoice.execute({
            branchId,
            clientId,
            employeeId,
            bookingId,
            subtotal: price,
          });
        } catch (err) {
          // ConflictException = idempotent re-delivery — safe to ignore
          if ((err as { status?: number }).status === 409) return;
          this.logger.error(`Failed to create invoice for booking ${bookingId}`, err);
          throw err;
        }
      },
    );
  }
}
