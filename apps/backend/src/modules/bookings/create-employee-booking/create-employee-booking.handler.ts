import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateBookingHandler } from '../create-booking/create-booking.handler';
import { CreateEmployeeBookingDto } from './create-employee-booking.dto';

export type CreateEmployeeBookingCommand = CreateEmployeeBookingDto & {
  /** Employee performing the booking — derived from the JWT in the controller. */
  employeeId: string;
};

@Injectable()
export class CreateEmployeeBookingHandler {
  constructor(private readonly createBooking: CreateBookingHandler) {}

  /**
   * Create a booking on the calling employee's calendar.
   *
   * The mobile-employee surface is intentionally narrower than the dashboard
   * create surface: `employeeId` is always the JWT subject (no booking on
   * someone else's calendar), and `bookingType` defaults to `INDIVIDUAL` so
   * a typical walk-in or in-person flow only needs the bare minimum payload.
   */
  async execute(command: CreateEmployeeBookingCommand) {
    if (!command.employeeId) {
      throw new ForbiddenException('Employee can only book on their own calendar');
    }
    return this.createBooking.execute({
      branchId: command.branchId,
      clientId: command.clientId,
      employeeId: command.employeeId,
      serviceId: command.serviceId,
      scheduledAt: new Date(command.scheduledAt),
      durationOptionId: command.durationOptionId,
      bookingType: command.bookingType ?? 'INDIVIDUAL',
      notes: command.notes,
    });
  }
}
