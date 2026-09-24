import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/guards/jwt.guard';
import { ApiStandardResponses } from '../../../common/swagger';
import { ReviewLoginHandler } from '../../../modules/identity/review-login/review-login.handler';
import { ReviewLoginDto } from '../../../modules/identity/review-login/review-login.dto';

@ApiTags('Mobile Client / Identity')
@Controller('mobile/auth')
export class MobileReviewAuthController {
  constructor(private readonly login: ReviewLoginHandler) {}

  @Post('review-login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Log in to the explicitly configured synthetic review account' })
  @ApiOkResponse({ schema: { type: 'object', required: ['sessionKind', 'tokens'], properties: {
    sessionKind: { type: 'string', enum: ['client'] },
    tokens: { type: 'object', required: ['accessToken', 'refreshToken'], properties: {
      accessToken: { type: 'string' }, refreshToken: { type: 'string' },
    } },
  } } })
  @ApiStandardResponses()
  loginReviewAccount(@Body() dto: ReviewLoginDto, @Ip() ip: string) {
    return this.login.execute(dto, ip);
  }
}
