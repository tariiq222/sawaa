import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { RequestEmailEntryDto, VerifyEmailEntryDto, RequestEmailEntryPhoneDto, ResendEmailEntryPhoneDto, VerifyEmailEntryPhoneDto } from '../../../modules/identity/mobile-email-entry/mobile-email-entry.dto';
import { EmailEntryChallengeDto, EmailEntryContinueDto, EmailEntryPhoneChallengeDto, EmailEntrySessionDto, EmailEntryUnavailableDto } from '../../../modules/identity/mobile-email-entry/mobile-email-entry.response';
import { RequestEmailEntryHandler } from '../../../modules/identity/mobile-email-entry/request-email-entry.handler';
import { VerifyEmailEntryHandler } from '../../../modules/identity/mobile-email-entry/verify-email-entry.handler';
import { RequestEmailEntryPhoneHandler } from '../../../modules/identity/mobile-email-entry/request-email-entry-phone.handler';
import { ResendEmailEntryPhoneHandler } from '../../../modules/identity/mobile-email-entry/resend-email-entry-phone.handler';
import { VerifyEmailEntryPhoneHandler } from '../../../modules/identity/mobile-email-entry/verify-email-entry-phone.handler';

@ApiTags('Mobile Client / Identity')
@ApiExtraModels(EmailEntrySessionDto, EmailEntryContinueDto, EmailEntryUnavailableDto)
@Controller('mobile/auth/email-entry')
@Public()
export class MobileEmailEntryController {
  constructor(private readonly request: RequestEmailEntryHandler, private readonly verify: VerifyEmailEntryHandler,
    private readonly requestPhone: RequestEmailEntryPhoneHandler, private readonly resendPhone: ResendEmailEntryPhoneHandler,
    private readonly verifyPhone: VerifyEmailEntryPhoneHandler) {}

  @Post('request') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Send a mobile email ownership code' })
  @ApiOkResponse({ type: EmailEntryChallengeDto }) @ApiStandardResponses()
  requestEmail(@Body() dto: RequestEmailEntryDto) { return this.request.execute(dto); }

  @Post('verify') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify email ownership and determine the next step' })
  @ApiOkResponse({ schema: { oneOf: [EmailEntrySessionDto, EmailEntryContinueDto, EmailEntryUnavailableDto].map(type => ({ $ref: getSchemaPath(type) })), discriminator: { propertyName: 'next' } } }) @ApiStandardResponses()
  verifyEmail(@Body() dto: VerifyEmailEntryDto) { return this.verify.execute(dto); }

  @Post('request-phone') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Bind details and send a phone ownership code' })
  @ApiOkResponse({ type: EmailEntryPhoneChallengeDto }) @ApiStandardResponses()
  requestPhoneCode(@Body() dto: RequestEmailEntryPhoneDto) { return this.requestPhone.execute(dto); }

  @Post('resend-phone') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Replace a mobile phone ownership challenge' })
  @ApiOkResponse({ type: EmailEntryPhoneChallengeDto }) @ApiStandardResponses()
  resendPhoneCode(@Body() dto: ResendEmailEntryPhoneDto) { return this.resendPhone.execute(dto); }

  @Post('verify-phone') @HttpCode(200) @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify phone ownership and issue a client session' })
  @ApiOkResponse({ type: EmailEntrySessionDto }) @ApiStandardResponses()
  verifyPhoneCode(@Body() dto: VerifyEmailEntryPhoneDto) { return this.verifyPhone.execute(dto); }
}
