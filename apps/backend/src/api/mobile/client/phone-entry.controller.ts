import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Header, HttpCode, HttpException, Post, UseFilters } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { CompletePhoneEntryDto, RequestPhoneEntryDto, ResendPhoneEntryDto, VerifyPhoneEntryDto } from '../../../modules/identity/mobile-phone-entry/mobile-phone-entry.dto';
import { PhoneEntryChallengeDto, PhoneEntryContinueDto, PhoneEntrySessionDto, PhoneEntryUnavailableDto } from '../../../modules/identity/mobile-phone-entry/mobile-phone-entry.response';
import { RequestPhoneEntryHandler } from '../../../modules/identity/mobile-phone-entry/request-phone-entry.handler';
import { ResendPhoneEntryHandler } from '../../../modules/identity/mobile-phone-entry/resend-phone-entry.handler';
import { VerifyPhoneEntryHandler } from '../../../modules/identity/mobile-phone-entry/verify-phone-entry.handler';
import { CompletePhoneEntryHandler } from '../../../modules/identity/mobile-phone-entry/complete-phone-entry.handler';

const PHONE_ENTRY_ERROR_CODES = new Set([
  'invalid_phone', 'invalid_details', 'invalid_or_expired_code', 'invalid_or_expired_flow',
  'delivery_unavailable', 'send_limited', 'details_unavailable',
]);

// Global validation runs before route pipes. Keep its errors and provider failures
// inside this API's safe machine-code contract without exposing internal messages.
@Catch(HttpException)
export class PhoneEntryValidationFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const payload = exception.getResponse();
    const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const messages = Array.isArray(body.message) ? body.message : [body.message];
    const candidate = typeof body.code === 'string' ? body.code : messages.find(message => typeof message === 'string' && PHONE_ENTRY_ERROR_CODES.has(message));
    const status = exception.getStatus();
    const code = typeof candidate === 'string' && PHONE_ENTRY_ERROR_CODES.has(candidate)
      ? candidate : status === 429 ? 'send_limited' : status >= 500 ? 'delivery_unavailable' : 'invalid_details';
    const retryAfterSeconds = typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds) && body.retryAfterSeconds >= 0
      ? body.retryAfterSeconds : undefined;
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json({ statusCode: status, code, message: code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
  }
}

@UseFilters(new PhoneEntryValidationFilter())
@ApiTags('Mobile Client / Identity')
@ApiExtraModels(PhoneEntrySessionDto, PhoneEntryContinueDto, PhoneEntryUnavailableDto)
@Controller('mobile/auth/phone-entry')
@Public()
export class MobilePhoneEntryController {
  constructor(
    private readonly request: RequestPhoneEntryHandler,
    private readonly resend: ResendPhoneEntryHandler,
    private readonly verify: VerifyPhoneEntryHandler,
    private readonly complete: CompletePhoneEntryHandler,
  ) {}

  @Post('request') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Send a mobile phone ownership code' })
  @ApiOkResponse({ type: PhoneEntryChallengeDto }) @ApiStandardResponses()
  requestPhone(@Body() dto: RequestPhoneEntryDto) { return this.request.execute(dto); }

  @Post('resend') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Replace a mobile phone ownership challenge' })
  @ApiOkResponse({ type: PhoneEntryChallengeDto }) @ApiStandardResponses()
  resendPhone(@Body() dto: ResendPhoneEntryDto) { return this.resend.execute(dto); }

  @Post('verify') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify phone ownership and determine the next step' })
  @ApiOkResponse({ schema: { oneOf: [PhoneEntrySessionDto, PhoneEntryContinueDto, PhoneEntryUnavailableDto].map(type => ({ $ref: getSchemaPath(type) })), discriminator: { propertyName: 'next' } } }) @ApiStandardResponses()
  verifyPhone(@Body() dto: VerifyPhoneEntryDto) { return this.verify.execute(dto); }

  @Post('complete') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Complete a phone-proven client account and issue a session' })
  @ApiOkResponse({ type: PhoneEntrySessionDto }) @ApiStandardResponses()
  completeAccount(@Body() dto: CompletePhoneEntryDto) { return this.complete.execute(dto); }
}
