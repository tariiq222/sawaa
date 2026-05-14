import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { UserId } from '../../../common/auth/user-id.decorator';
import { RegisterMobileUserDto } from '../../../modules/identity/register-mobile-user/register-mobile-user.dto';
import { RegisterMobileUserHandler } from '../../../modules/identity/register-mobile-user/register-mobile-user.handler';
import { RequestMobileLoginOtpDto } from '../../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.dto';
import { RequestMobileLoginOtpHandler } from '../../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.handler';
import { VerifyMobileOtpDto } from '../../../modules/identity/verify-mobile-otp/verify-mobile-otp.dto';
import { VerifyMobileOtpHandler } from '../../../modules/identity/verify-mobile-otp/verify-mobile-otp.handler';
import { RequestEmailVerificationHandler } from '../../../modules/identity/request-email-verification/request-email-verification.handler';

@ApiTags('Mobile Client / Identity')
@Controller('mobile/auth')
export class MobileClientAuthController {
  constructor(
    private readonly register: RegisterMobileUserHandler,
    private readonly requestLogin: RequestMobileLoginOtpHandler,
    private readonly verifyOtp: VerifyMobileOtpHandler,
    private readonly requestEmailVerification: RequestEmailVerificationHandler,
  ) {}

  @Post('register')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Register a new mobile user (creates user + sends SMS OTP)' })
  @ApiStandardResponses()
  async registerUser(@Body() dto: RegisterMobileUserDto) {
    return this.register.execute(dto);
  }

  @Post('request-login-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Request a login OTP via phone or verified email' })
  @ApiStandardResponses()
  async requestLoginOtp(@Body() dto: RequestMobileLoginOtpDto) {
    return this.requestLogin.execute(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Verify register/login OTP and issue tokens' })
  @ApiStandardResponses()
  async verifyMobileOtp(@Body() dto: VerifyMobileOtpDto) {
    return this.verifyOtp.execute(dto);
  }

  @Post('request-email-verification')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Send email verification link to the authenticated user' })
  @ApiStandardResponses()
  async requestEmail(@UserId() userId: string) {
    return this.requestEmailVerification.execute({ userId });
  }
}
