import { ArgumentsHost, Body, Catch, Controller, Delete, ExceptionFilter, Get, Header, HttpCode, HttpException, Patch, Post, Res, UseFilters } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { respondToClientPhoneVerification } from '../../common/auth/client-phone-session-response';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ClientProfileDto } from '../../modules/identity/client-auth/client-profile.dto';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { UpdateClientProfileDto } from '../../modules/identity/client-auth/update-client-profile.dto';
import { UpdateClientProfileHandler } from '../../modules/identity/client-auth/update-client-profile.handler';
import { RequestAccountDeletionHandler } from '../../modules/identity/request-account-deletion/request-account-deletion.handler';
import { GetClientEmailStatusHandler } from '../../modules/identity/client-email/get-client-email-status.handler';
import { RequestClientEmailHandler } from '../../modules/identity/client-email/request-client-email.handler';
import { VerifyClientEmailHandler } from '../../modules/identity/client-email/verify-client-email.handler';
import { DeclineClientEmailHandler } from '../../modules/identity/client-email/decline-client-email.handler';
import { RequestClientEmailDto, VerifyClientEmailDto } from '../../modules/identity/client-email/client-email.dto';
import { ClientEmailChallengeDto, ClientEmailStatusDto } from '../../modules/identity/client-email/client-email.response';
import { RequestClientPhoneHandler } from '../../modules/identity/client-phone/request-client-phone.handler';
import { VerifyClientPhoneHandler } from '../../modules/identity/client-phone/verify-client-phone.handler';
import { RequestClientPhoneDto, VerifyClientPhoneDto } from '../../modules/identity/client-phone/client-phone.dto';
import { ClientPhoneChallengeDto, ClientPhoneVerifiedDto } from '../../modules/identity/client-phone/client-phone.response';

const CLIENT_EMAIL_ERROR_CODES = new Set([
  'invalid_email', 'invalid_or_expired_code', 'email_unchanged', 'email_verified',
  'details_unavailable', 'send_limited', 'delivery_unavailable', 'client_unavailable',
]);
const CLIENT_PHONE_ERROR_CODES = new Set([
  'invalid_phone', 'invalid_or_expired_code', 'phone_unchanged',
  'details_unavailable', 'send_limited', 'delivery_unavailable', 'client_unavailable',
]);

/**
 * Global validation and provider errors must stay inside the safe machine-code
 * contract of the email/phone verification routes (no internal messages leak).
 */
function contactErrorFilter(codes: ReadonlySet<string>) {
  @Catch(HttpException)
  class ClientContactErrorFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
      const response = host.switchToHttp().getResponse<Response>();
      const payload = exception.getResponse();
      const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
      const messages = Array.isArray(body.message) ? body.message : [body.message];
      const candidate = typeof body.code === 'string' ? body.code : messages.find(m => typeof m === 'string' && codes.has(m));
      const status = exception.getStatus();
      const code = typeof candidate === 'string' && codes.has(candidate)
        ? candidate : status === 429 ? 'send_limited' : status >= 500 ? 'delivery_unavailable' : 'invalid_or_expired_code';
      const retryAfterSeconds = typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds) && body.retryAfterSeconds >= 0
        ? body.retryAfterSeconds : undefined;
      response.setHeader('Cache-Control', 'no-store');
      response.status(status).json({ statusCode: status, code, message: code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
    }
  }
  return new ClientContactErrorFilter();
}

@ApiTags('Client / Profile')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/profile')
export class ClientProfileController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly updateClientProfile: UpdateClientProfileHandler,
    private readonly requestAccountDeletion: RequestAccountDeletionHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated client's profile" })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Client profile record' })
  getProfile(@ClientSession() session: ClientSession) {
    return this.getMe.execute(session.id);
  }

  @ClientThrottle('write')
  @Patch()
  @ApiOperation({ summary: "Update the authenticated client's profile" })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Updated client profile' })
  updateProfile(@ClientSession() session: ClientSession, @Body() body: UpdateClientProfileDto) {
    return this.updateClientProfile.execute(session.id, body);
  }

  @ClientThrottle('write')
  @Delete()
  @ApiOperation({ summary: "Close the authenticated client's login immediately" })
  @ApiOkResponse({
    description: 'Login closed; clinical and financial records retained',
    schema: {
      type: 'object', required: ['status', 'retained'],
      properties: {
        status: { type: 'string', enum: ['closed'] },
        retained: { type: 'array', items: { type: 'string', enum: ['clinical_records', 'financial_records'] } },
      },
    },
  })
  deleteProfile(@ClientSession() session: ClientSession) {
    return this.requestAccountDeletion.execute({ clientId: session.id });
  }
}

@UseFilters(contactErrorFilter(CLIENT_EMAIL_ERROR_CODES))
@ApiTags('Client / Profile')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/profile/email')
export class ClientEmailController {
  constructor(
    private readonly readStatus: GetClientEmailStatusHandler,
    private readonly requestEmail: RequestClientEmailHandler,
    private readonly verifyEmail: VerifyClientEmailHandler,
    private readonly declineEmail: DeclineClientEmailHandler,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "Get the authenticated client's email verification state" })
  @ApiOkResponse({ type: ClientEmailStatusDto })
  status(@ClientSession() session: ClientSession) { return this.readStatus.execute(session.id); }

  @Post('request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Send a code to prove ownership of a new client email' })
  @ApiOkResponse({ type: ClientEmailChallengeDto })
  request(@ClientSession() session: ClientSession, @Body() body: RequestClientEmailDto) { return this.requestEmail.execute(session.id, body); }

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Verify the code and adopt the new client email' })
  @ApiOkResponse({ type: ClientEmailStatusDto })
  verify(@ClientSession() session: ClientSession, @Body() body: VerifyClientEmailDto) { return this.verifyEmail.execute(session.id, body); }

  @Post('decline')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Drop the unverified client email and resolve the prompt' })
  @ApiOkResponse({ type: ClientEmailStatusDto })
  decline(@ClientSession() session: ClientSession) { return this.declineEmail.execute(session.id); }
}

@UseFilters(contactErrorFilter(CLIENT_PHONE_ERROR_CODES))
@ApiTags('Client / Profile')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/profile/phone')
@ApiExtraModels(ClientPhoneVerifiedDto)
export class ClientPhoneController {
  constructor(
    private readonly requestPhone: RequestClientPhoneHandler,
    private readonly verifyPhone: VerifyClientPhoneHandler,
  ) {}

  @Post('request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Send a code to prove ownership of a new client phone' })
  @ApiOkResponse({ type: ClientPhoneChallengeDto })
  request(@ClientSession() session: ClientSession, @Body() body: RequestClientPhoneDto) { return this.requestPhone.execute(session.id, body); }

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Verify the code, adopt the new client phone and rotate session tokens' })
  @ApiOkResponse({ schema: { oneOf: [
    { type: 'object', required: ['phone'], properties: { phone: { type: 'string' } }, description: 'Web sessions receive rotated HTTP-only cookies' },
    { $ref: getSchemaPath(ClientPhoneVerifiedDto) },
  ] } })
  async verify(@ClientSession() session: ClientSession, @Body() body: VerifyClientPhoneDto, @Res({ passthrough: true }) response?: Response) {
    return respondToClientPhoneVerification(await this.verifyPhone.execute(session.id, body, session.channel), session.channel, response);
  }
}
