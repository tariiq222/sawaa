import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { ApiPublicResponses } from '../../common/swagger';

export class PublicSlotsQuery {
  @ApiProperty({ description: 'Employee UUID to check availability for', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Branch UUID where the appointment will take place', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Date to check availability for (ISO 8601 date string)', example: '2026-05-01' })
  @IsDateString() date!: string;

  @ApiPropertyOptional({ description: 'Override slot duration in minutes', example: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMins?: number;

  @ApiPropertyOptional({ description: 'Service UUID used to infer duration and booking rules', example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  @IsOptional() @IsUUID() serviceId?: string;

  @ApiPropertyOptional({ description: 'Duration option UUID for services with multiple duration choices', example: 'd4e5f6a7-b8c9-0123-defa-234567890123' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Booking type filter', enum: BookingType, example: BookingType.INDIVIDUAL })
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType;
}

@ApiTags('Public / Slots')
@ApiPublicResponses()
@Controller('public/availability')
export class PublicSlotsController {
  constructor(private readonly checkAvailability: CheckAvailabilityHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  @ApiOperation({ summary: 'Get available booking slots for an employee on a given date' })
  @ApiOkResponse({ description: 'Array of available time slots' })
  getSlots(@Query() q: PublicSlotsQuery) {
    return this.checkAvailability.execute({
      employeeId: q.employeeId,
      branchId: q.branchId,
      date: new Date(q.date),
      durationMins: q.durationMins,
      serviceId: q.serviceId,
      durationOptionId: q.durationOptionId,
      bookingType: q.bookingType,
    });
  }
}
