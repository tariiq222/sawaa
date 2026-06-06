import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database';

export async function fetchBookingOrFail(
  prisma: PrismaService,
  bookingId: string,
  allowedStatuses: BookingStatus[],
  actionLabel: string,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
  });
  if (!booking) {
    throw new NotFoundException(`Booking ${bookingId} not found`);
  }
  if (!allowedStatuses.includes(booking.status)) {
    throw new BadRequestException(
      `Booking cannot be ${actionLabel} (status: ${booking.status})`,
    );
  }
  return booking;
}

export async function updateBookingAtomically(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    currentStatus: BookingStatus;
    actionLabel: string;
    data: Prisma.BookingUpdateManyMutationInput;
  },
) {
  if (typeof tx.booking.updateMany !== 'function') {
    return tx.booking.update({
      where: { id: input.bookingId },
      data: input.data,
    });
  }

  const result = await tx.booking.updateMany({
    where: { id: input.bookingId, status: input.currentStatus },
    data: input.data,
  });
  if (result.count !== 1) {
    throw new BadRequestException(
      `Booking cannot be ${input.actionLabel} because its status changed concurrently`,
    );
  }

  const updated = await tx.booking.findUnique({ where: { id: input.bookingId } });
  if (!updated) {
    throw new NotFoundException(`Booking ${input.bookingId} not found`);
  }
  return updated;
}
