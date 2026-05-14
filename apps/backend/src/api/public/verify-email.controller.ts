import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { VerifyEmailHandler } from '../../modules/identity/verify-email/verify-email.handler';

@ApiTags('Public / Identity')
@Controller('public/verify-email')
export class PublicVerifyEmailController {
  constructor(private readonly verifyEmail: VerifyEmailHandler) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify an email-verification token' })
  @ApiStandardResponses()
  async verify(@Query('token') token: string) {
    return this.verifyEmail.execute({ token });
  }
}
