import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateZoomMeetingHandler } from '../create-zoom-meeting/create-zoom-meeting.handler';

export interface RetryZoomMeetingCommand {
  bookingId: string;
}

@Injectable()
export class RetryZoomMeetingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createZoomMeeting: CreateZoomMeetingHandler,
  ) {}

  async execute(cmd: RetryZoomMeetingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    // Handled by CreateZoomMeetingHandler (idempotency + status check)
    return this.createZoomMeeting.execute({
      bookingId: cmd.bookingId,
    });
  }
}
