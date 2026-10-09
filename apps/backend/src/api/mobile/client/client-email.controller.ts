import { ArgumentsHost, Body, Controller, Catch, ExceptionFilter, Get, Header, HttpCode, HttpException, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { GetClientEmailStatusHandler } from '../../../modules/identity/client-email/get-client-email-status.handler';
import { RequestClientEmailHandler } from '../../../modules/identity/client-email/request-client-email.handler';
import { VerifyClientEmailHandler } from '../../../modules/identity/client-email/verify-client-email.handler';
import { DeclineClientEmailHandler } from '../../../modules/identity/client-email/decline-client-email.handler';
import { RequestClientEmailDto, VerifyClientEmailDto } from '../../../modules/identity/client-email/client-email.dto';
import { ClientEmailChallengeDto, ClientEmailStatusDto } from '../../../modules/identity/client-email/client-email.response';

const CLIENT_EMAIL_ERROR_CODES = new Set([
  'invalid_email', 'invalid_or_expired_code', 'email_unchanged', 'email_verified',
  'details_unavailable', 'send_limited', 'delivery_unavailable', 'client_unavailable',
]);

// Global validation runs before route pipes. Keep its errors and provider failures
// inside this API's safe machine-code contract without exposing internal messages.
@Catch(HttpException)
export class ClientEmailValidationFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const payload = exception.getResponse();
    const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const messages = Array.isArray(body.message) ? body.message : [body.message];
    const candidate = typeof body.code === 'string' ? body.code : messages.find(message => typeof message === 'string' && CLIENT_EMAIL_ERROR_CODES.has(message));
    const status = exception.getStatus();
    const code = typeof candidate === 'string' && CLIENT_EMAIL_ERROR_CODES.has(candidate)
      ? candidate : status === 429 ? 'send_limited' : status >= 500 ? 'delivery_unavailable' : 'invalid_or_expired_code';
    const retryAfterSeconds = typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds) && body.retryAfterSeconds >= 0
      ? body.retryAfterSeconds : undefined;
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json({ statusCode: status, code, message: code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
  }
}

@UseFilters(new ClientEmailValidationFilter())
@ApiTags('Mobile Client / Profile')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/profile/email')
export class MobileClientEmailController {
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
  status(@ClientSession() user: ClientSession) { return this.readStatus.execute(user.id); }

  @Post('request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Send a code to prove ownership of a new client email' })
  @ApiOkResponse({ type: ClientEmailChallengeDto })
  request(@ClientSession() user: ClientSession, @Body() body: RequestClientEmailDto) { return this.requestEmail.execute(user.id, body); }

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Verify the code and adopt the new client email' })
  @ApiOkResponse({ type: ClientEmailStatusDto })
  verify(@ClientSession() user: ClientSession, @Body() body: VerifyClientEmailDto) { return this.verifyEmail.execute(user.id, body); }

  @Post('decline')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Drop the unverified client email and resolve the prompt' })
  @ApiOkResponse({ type: ClientEmailStatusDto })
  decline(@ClientSession() user: ClientSession) { return this.declineEmail.execute(user.id); }
}
