import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query for `GET /client/bookings`. */
export class ClientListBookingsQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;

  @ApiPropertyOptional({
    description:
      'Tab filter. `upcoming` and `past` are by appointment date; `cancelled` is by status (CANCELLED / CANCEL_REQUESTED).',
    enum: ['upcoming', 'past', 'cancelled'],
  })
  @IsOptional() @IsIn(['upcoming', 'past', 'cancelled']) tab?: 'upcoming' | 'past' | 'cancelled';

  @ApiPropertyOptional({ description: 'Filter by booking status', enum: BookingStatus, enumName: 'BookingStatus' })
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}
