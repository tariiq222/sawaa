import { Body, Controller, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard, Public } from '../../../common/guards/jwt.guard';
import { UserId } from '../../../common/auth/user-id.decorator';
import { RegisterMobileUserDto } from '../../../modules/identity/register-mobile-user/register-mobile-user.dto';
import { RegisterMobileUserHandler } from '../../../modules/identity/register-mobile-user/register-mobile-user.handler';
import { RequestMobileLoginOtpDto } from '../../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.dto';
import { RequestMobileLoginOtpHandler } from '../../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.handler';
import { VerifyMobileOtpDto } from '../../../modules/identity/verify-mobile-otp/verify-mobile-otp.dto';
import { VerifyMobileOtpHandler } from '../../../modules/identity/verify-mobile-otp/verify-mobile-otp.handler';
import { RequestEmailVerificationHandler } from '../../../modules/identity/request-email-verification/request-email-verification.handler';
import { NativeSessionDto } from '../../../modules/identity/native-session/native-session.dto';
import { NativeRefreshHandler } from '../../../modules/identity/native-session/native-refresh.handler';
import { MobilePasswordLoginDto } from '../../../modules/identity/mobile-password-login/mobile-password-login.dto';
import { MobilePasswordLoginHandler } from '../../../modules/identity/mobile-password-login/mobile-password-login.handler';
import { NativeLogoutHandler } from '../../../modules/identity/native-session/native-logout.handler';

@ApiTags('Mobile Client / Identity')
@Controller('mobile/auth')
export class MobileClientAuthController {
  constructor(
    private readonly register: RegisterMobileUserHandler,
    private readonly requestLogin: RequestMobileLoginOtpHandler,
    private readonly verifyOtp: VerifyMobileOtpHandler,
    private readonly requestEmailVerification: RequestEmailVerificationHandler,
    private readonly nativeRefresh: NativeRefreshHandler,
    private readonly nativeLogout: NativeLogoutHandler,
    private readonly passwordLogin: MobilePasswordLoginHandler,
  ) {}

  @Post('register')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Register a new mobile user (creates user + sends SMS OTP)' })
  @ApiOkResponse({ description: 'User registered, OTP sent' })
  @ApiStandardResponses()
  async registerUser(@Body() dto: RegisterMobileUserDto) {
    return this.register.execute(dto);
  }

  @Post('password-login')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Log in a customer with email or phone and password' })
  @ApiOkResponse({
    description: 'Customer authenticated, native client tokens issued',
    schema: {
      type: 'object',
      required: ['sessionKind', 'tokens'],
      properties: {
        sessionKind: { type: 'string', enum: ['client'] },
        tokens: {
          type: 'object', required: ['accessToken', 'refreshToken'],
          properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } },
        },
      },
    },
  })
  @ApiStandardResponses()
  async loginWithPassword(@Body() dto: MobilePasswordLoginDto, @Ip() ip: string) {
    return this.passwordLogin.execute(dto, ip);
  }

  @Post('request-login-otp')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Request a login OTP via phone or verified email' })
  @ApiOkResponse({ description: 'Login OTP sent' })
  @ApiStandardResponses()
  async requestLoginOtp(@Body() dto: RequestMobileLoginOtpDto) {
    return this.requestLogin.execute(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Verify register/login OTP and issue tokens' })
  @ApiOkResponse({
    description: 'OTP verified, tokens issued',
    schema: {
      type: 'object',
      properties: {
        tokens: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } },
        sessionKind: { type: 'string', enum: ['client', 'staff'], description: 'Mobile routing hint; JWT guards remain authoritative' },
      },
    },
  })
  @ApiStandardResponses()
  async verifyMobileOtp(@Body() dto: VerifyMobileOtpDto) {
    return this.verifyOtp.execute(dto);
  }

  @Post('request-email-verification')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Send email verification link to the authenticated user' })
  @ApiOkResponse({ description: 'Verification email sent' })
  @ApiStandardResponses()
  async requestEmail(@UserId() userId: string) {
    return this.requestEmailVerification.execute({ userId });
  }

  @Post('refresh')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Rotate a native mobile refresh token' })
  @ApiOkResponse({ description: 'Native access and refresh tokens issued' })
  @ApiStandardResponses()
  async refresh(@Body() dto: NativeSessionDto) {
    return this.nativeRefresh.execute(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Revoke native mobile sessions' })
  @ApiNoContentResponse({ description: 'Native sessions revoked' })
  @ApiStandardResponses()
  async logout(@Body() dto: NativeSessionDto): Promise<void> {
    await this.nativeLogout.execute(dto.refreshToken);
  }
}
