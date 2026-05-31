import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ResolveApplicableIntakeFormsHandler } from '../../modules/org-experience/resolve-applicable-intake-forms/resolve-applicable-intake-forms.handler';
import { ResolveApplicableIntakeFormsDto } from '../../modules/org-experience/resolve-applicable-intake-forms/resolve-applicable-intake-forms.dto';
import { SubmitIntakeResponseHandler } from '../../modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { SubmitIntakeResponseDto } from '../../modules/org-experience/submit-intake-response/submit-intake-response.dto';

@ApiTags('Public / Org Experience')
@ApiPublicResponses()
@Controller('public')
export class PublicIntakeFormsController {
  constructor(
    private readonly resolveApplicable: ResolveApplicableIntakeFormsHandler,
    private readonly submitResponse: SubmitIntakeResponseHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('intake-forms/applicable')
  @ApiOperation({ summary: 'List active intake forms that apply to a booking context' })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' }, description: 'Applicable intake forms with ordered fields' } })
  async applicable(@Query() query: ResolveApplicableIntakeFormsDto) {
    return this.resolveApplicable.execute(query);
  }

  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('bookings/:bookingId/intake-responses')
  @ApiOperation({ summary: 'Submit intake form answers for one of your bookings (requires client auth)' })
  @ApiCreatedResponse({ schema: { type: 'object', description: 'Persisted intake response' } })
  @ApiResponse({ status: 400, description: 'Validation failed (missing required field, unknown field, or invalid option)' })
  @ApiResponse({ status: 404, description: 'Booking or form not found' })
  async submit(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: SubmitIntakeResponseDto,
    @ClientSession() client: { id: string },
  ) {
    return this.submitResponse.execute({
      bookingId,
      formId: body.formId,
      answers: body.answers,
      clientId: client.id,
    });
  }
}
