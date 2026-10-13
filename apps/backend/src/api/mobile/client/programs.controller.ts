import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ClientThrottle } from '../../../common/throttle/client-throttle';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ClientRoute } from '../../../common/auth/client-route.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { EnrollInProgramHandler } from '../../../modules/bookings/enroll-in-program/enroll-in-program.handler';

@ApiTags('Mobile Client / Programs')
@ApiStandardResponses()
@ClientRoute()
@Controller('mobile/client/programs')
export class MobileClientProgramsController {
  constructor(private readonly enrollInProgram: EnrollInProgramHandler) {}

  @ClientThrottle('money')
  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll the authenticated client in a public program' })
  @ApiParam({ name: 'id', description: 'Public program UUID', format: 'uuid' })
  @ApiCreatedResponse({
    description: 'Program enrollment created or resumed',
    schema: {
      type: 'object',
      required: ['type', 'bookingId', 'status', 'invoiceId'],
      properties: {
        type: { type: 'string', enum: ['ENROLLED'] },
        bookingId: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        invoiceId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({ status: 409, description: 'Program full or enrollment unavailable' })
  enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() user: ClientSession,
  ) {
    return this.enrollInProgram.execute({
      programId: id,
      clientId: user.id,
      public: true,
    });
  }
}
