import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { VerifyEmailHandler } from '../../modules/identity/verify-email/verify-email.handler';
import { Public } from '../../common/guards/jwt.guard';
import { PublicVerifyEmailResponseDto } from './verify-email-response.dto';

@ApiTags('Public / Identity')
@Public()
@Controller('public/verify-email')
export class PublicVerifyEmailController {
  constructor(private readonly verifyEmail: VerifyEmailHandler) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify an email-verification token' })
  @ApiOkResponse({ type: PublicVerifyEmailResponseDto, description: 'The token was valid, unexpired and unused' })
  @ApiStandardResponses()
  async verify(@Query('token') token: string): Promise<PublicVerifyEmailResponseDto> {
    return this.verifyEmail.execute({ token });
  }
}
