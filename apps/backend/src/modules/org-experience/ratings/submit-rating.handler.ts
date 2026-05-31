import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { SubmitRatingDto } from './submit-rating.dto';

export type SubmitRatingCommand = SubmitRatingDto;

@Injectable()
export class SubmitRatingHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: SubmitRatingCommand) {
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    // The referenced booking must exist and be COMPLETED. clientId/employeeId are
    // derived from the booking, never trusted from the request body.
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: { id: true, clientId: true, employeeId: true, status: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('Booking must be completed before it can be rated');
    }

    const existing = await this.prisma.rating.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) throw new ConflictException('Rating already submitted for this booking');

    return this.prisma.rating.create({
      data: {
        bookingId: booking.id,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        score: dto.score,
        comment: dto.comment,
        // Client-supplied visibility is never trusted; an admin flips visibility
        // later via the update-rating-visibility slice.
        isPublic: false,
      },
    });
  }
}
