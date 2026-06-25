import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '../../../infrastructure/events';
import { CreateInvoiceHandler } from './create-invoice.handler';

interface BookingConfirmedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  branchId: string;
  price: number;
  discountedPrice?: number | null;
  currency: string;
}

/**
 * Fallback subscriber for `bookings.booking.confirmed`.
 *
 * The primary creation path is inline inside the booking handlers
  * (`create-booking`, `complete-booking` for payAtClinic).
 * This handler exists only to cover edge paths that emit
 * `bookings.booking.confirmed` without a pre-created invoice
 * (e.g., legacy flows or future external integrations). When the invoice
 * already exists the @@unique([bookingId]) constraint surfaces a
 * ConflictException which we swallow as idempotent re-delivery.
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
        const { bookingId, clientId, employeeId, branchId, price, discountedPrice } =
          envelope.payload;
        try {
          await this.createInvoice.execute({
            branchId,
            clientId,
            employeeId,
            bookingId,
            subtotal: price,
            discountAmt:
              discountedPrice !== null && discountedPrice !== undefined
                ? price - discountedPrice
                : undefined,
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
