import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicAvailabilityHandler } from '../../modules/bookings/availability/public/get-public-availability.handler';
import { GetPublicAvailabilityDto } from '../../modules/bookings/availability/public/get-public-availability.dto';
import { GetPublicAvailabilityDaysHandler } from '../../modules/bookings/availability/public/get-public-availability-days.handler';
import { GetPublicAvailabilityDaysDto } from '../../modules/bookings/availability/public/get-public-availability-days.dto';

@ApiTags('Public / Employees')
@ApiPublicResponses()
@Controller('public/employees')
export class PublicAvailabilityController {
  constructor(
    private readonly availabilityHandler: GetPublicAvailabilityHandler,
    private readonly daysHandler: GetPublicAvailabilityDaysHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':id/availability')
  @ApiOperation({ summary: 'Get available time slots for an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID or slug', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Array of available time slots' })
  async getAvailability(@Param('id') id: string, @Query() query: GetPublicAvailabilityDto) {
    return this.availabilityHandler.execute({
      ...query,
      employeeId: id,
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':id/availability/days')
  @ApiOperation({ summary: 'Probe which days in a window have any open slots' })
  @ApiParam({ name: 'id', description: 'Employee ID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Per-day boolean: does this day have at least one open slot?' })
  async getAvailabilityDays(
    @Param('id') id: string,
    @Query() query: GetPublicAvailabilityDaysDto,
  ) {
    return this.daysHandler.execute({
      ...query,
      employeeId: id,
    });
  }
}
