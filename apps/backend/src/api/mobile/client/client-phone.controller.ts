import { ArgumentsHost, Body, Controller, Catch, ExceptionFilter, Header, HttpCode, HttpException, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { RequestClientPhoneHandler } from '../../../modules/identity/client-phone/request-client-phone.handler';
import { VerifyClientPhoneHandler } from '../../../modules/identity/client-phone/verify-client-phone.handler';
import { RequestClientPhoneDto, VerifyClientPhoneDto } from '../../../modules/identity/client-phone/client-phone.dto';
import { ClientPhoneChallengeDto, ClientPhoneVerifiedDto } from '../../../modules/identity/client-phone/client-phone.response';

const CLIENT_PHONE_ERROR_CODES = new Set([
  'invalid_phone', 'invalid_or_expired_code', 'phone_unchanged',
  'details_unavailable', 'send_limited', 'delivery_unavailable', 'client_unavailable',
]);

// Global validation and provider errors must stay inside the safe machine-code contract.
@Catch(HttpException)
export class ClientPhoneValidationFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const payload = exception.getResponse();
    const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const messages = Array.isArray(body.message) ? body.message : [body.message];
    const candidate = typeof body.code === 'string' ? body.code : messages.find(message => typeof message === 'string' && CLIENT_PHONE_ERROR_CODES.has(message));
    const status = exception.getStatus();
    const code = typeof candidate === 'string' && CLIENT_PHONE_ERROR_CODES.has(candidate)
      ? candidate : status === 429 ? 'send_limited' : status >= 500 ? 'delivery_unavailable' : 'invalid_or_expired_code';
    const retryAfterSeconds = typeof body.retryAfterSeconds === 'number' && Number.isFinite(body.retryAfterSeconds) && body.retryAfterSeconds >= 0
      ? body.retryAfterSeconds : undefined;
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json({ statusCode: status, code, message: code, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
  }
}

@UseFilters(new ClientPhoneValidationFilter())
@ApiTags('Mobile Client / Profile')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/profile/phone')
export class MobileClientPhoneController {
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
  request(@ClientSession() user: ClientSession, @Body() body: RequestClientPhoneDto) { return this.requestPhone.execute(user.id, body); }

  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Verify the code, adopt the new client phone and rotate session tokens' })
  @ApiOkResponse({ type: ClientPhoneVerifiedDto })
  verify(@ClientSession() user: ClientSession, @Body() body: VerifyClientPhoneDto) { return this.verifyPhone.execute(user.id, body); }
}
