import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards,
  Req, Res, Ip,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiNoContentResponse, ApiResponse
} from '@nestjs/swagger';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { LoginDto } from '../../modules/identity/login/login.dto';
import { RefreshTokenDto } from '../../modules/identity/refresh-token/refresh-token.dto';
import { LogoutDto } from '../../modules/identity/logout/logout.dto';
import { RequestDashboardOtpHandler } from '../../modules/identity/request-dashboard-otp/request-dashboard-otp.handler';
import { RequestDashboardOtpDto } from '../../modules/identity/request-dashboard-otp/request-dashboard-otp.dto';
import { VerifyDashboardOtpHandler } from '../../modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler';
import { VerifyDashboardOtpDto } from '../../modules/identity/verify-dashboard-otp/verify-dashboard-otp.dto';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { DEFAULT_ORG_ID } from '../../common/constants';
import { UserId } from '../../common/auth/user-id.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { GetCurrentUserQuery } from '../../modules/identity/get-current-user/get-current-user.query';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';

import { AuthResponseBuilder } from '../../modules/identity/shared/auth-response.builder';
import { LookupUserHandler } from '../../modules/identity/lookup-user/lookup-user.handler';
import { LookupUserDto } from '../../modules/identity/lookup-user/lookup-user.dto';

import { RequestPasswordResetHandler } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.handler';
import { RequestPasswordResetDto } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.dto';
import { PerformPasswordResetHandler } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler';
import { PerformPasswordResetDto } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.dto';
import { Public } from '../../common/guards/jwt.guard';
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPublicResponses, ApiErrorDto } from '../../common/swagger';
import { flattenPermissions } from '../../modules/identity/casl/flatten-permissions';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password', example: 'P@ssw0rd123' })
  @IsString() currentPassword!: string;

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'NewP@ss456', format: 'password' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'newPassword must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'newPassword must contain at least one digit' })
  newPassword!: string;
}

@ApiTags('Public / Auth')
@ApiPublicResponses()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginHandler,
    private readonly logout: LogoutHandler,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly getCurrentUser: GetCurrentUserHandler,
    private readonly changePassword: ChangePasswordHandler,
    private readonly config: ConfigService,
    private readonly requestPasswordReset: RequestPasswordResetHandler,
    private readonly performPasswordReset: PerformPasswordResetHandler,
    private readonly requestDashboardOtp: RequestDashboardOtpHandler,
    private readonly verifyDashboardOtp: VerifyDashboardOtpHandler,
    private readonly settings: PlatformSettingsService,
    private readonly authResponseBuilder: AuthResponseBuilder,
    private readonly lookupUser: LookupUserHandler,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({
    description: 'Access token with user profile (refresh token delivered as httpOnly cookie ck_refresh), or a 2FA challenge when super-admin login requires OTP',
    schema: {
      type: 'object',
      properties: {
        requiresOtp: { type: 'boolean', description: 'True when 2FA is required — use OTP flow to complete login' },
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        expiresIn: { type: 'number', example: 900 },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string', nullable: true },
            gender: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            role: { type: 'string' },
            isSuperAdmin: { type: 'boolean' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ApiErrorDto })
  @ApiResponse({ status: 429, description: 'Too many attempts, try again later', type: ApiErrorDto })
  async loginEndpoint(
    @Body() body: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.login.execute({ email: body.email, password: body.password, ip, rememberMe: body.rememberMe });

    // If 2FA required and user is super-admin → require OTP step
    if (user?.isSuperAdmin) {
      const require2fa = await this.settings.get<boolean>('security.twoFactor.required');
      if (require2fa) {
        return { requiresOtp: true };
      }
    }

    if (!user) {
      this.setRefreshCookie(res, refreshToken, body.rememberMe);
      return {
        accessToken,
        user,
        expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
      };
    }

    const response = this.authResponseBuilder.build({ accessToken, refreshToken }, user);
    this.setRefreshCookie(res, refreshToken, body.rememberMe);
    return response;
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token and issue new access token (refresh token rotated via cookie)' })
  @ApiOkResponse({
    description: 'New access token (rotated refresh token delivered as httpOnly cookie ck_refresh)',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        expiresIn: { type: 'number', example: 900 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token', type: ApiErrorDto })
  async refreshEndpoint(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = (req.cookies as Record<string, string>)?.['ck_refresh'] ?? body.refreshToken;
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const record = await this.findActiveToken(rawToken);

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    const tokens = await this.tokens.issueTokenPair(user, {
      organizationId: DEFAULT_ORG_ID,
      isSuperAdmin: user.isSuperAdmin,
    });
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Post('logout')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token (log out)' })
  @ApiNoContentResponse({ description: 'Token revoked; no body returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token', type: ApiErrorDto })
  async logoutEndpoint(
    @Body() body: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = (req.cookies as Record<string, string>)?.['ck_refresh'] ?? body.refreshToken;
    res.clearCookie('ck_refresh', { path: '/' });
    if (!rawToken) return;
    const record = await this.findActiveToken(rawToken);
    await this.logout.execute({ userId: record.userId });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({
    description: 'Current user profile with role and permissions',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        phone: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        role: { type: 'string' },
        isSuperAdmin: { type: 'boolean' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT', type: ApiErrorDto })
  async meEndpoint(@UserId() userId: string) {
    const user = await this.getCurrentUser.execute({ userId } satisfies GetCurrentUserQuery);
    return { ...user, permissions: flattenPermissions(user) };
  }

  @Patch('password/change')
  @UseGuards(JwtGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user\'s password' })
  @ApiNoContentResponse({ description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT or wrong current password', type: ApiErrorDto })
  async changePasswordEndpoint(
    @UserId() userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    await this.changePassword.execute({
      userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Public()
  @Post('request-password-reset')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset email for a staff (User) account' })
  @ApiNoContentResponse({ description: 'Reset email sent (response is identical regardless of whether the email exists)' })
  async requestPasswordResetEndpoint(@Body() dto: RequestPasswordResetDto): Promise<void> {
    await this.requestPasswordReset.execute(dto);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset staff (User) password using a token from the reset email' })
  @ApiNoContentResponse({ description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token', type: ApiErrorDto })
  async performPasswordResetEndpoint(@Body() dto: PerformPasswordResetDto): Promise<void> {
    await this.performPasswordReset.execute(dto);
  }

  @Public()
  @Post('otp/request-dashboard')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for dashboard login' })
  @ApiOkResponse({
    description: 'OTP sent successfully',
    schema: { properties: { success: { type: 'boolean' } } },
  })
  async requestDashboardOtpEndpoint(@Body() dto: RequestDashboardOtpDto): Promise<{ success: boolean }> {
    return this.requestDashboardOtp.execute(dto);
  }

  @Public()
  @Post('otp/verify-dashboard')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP for dashboard login' })
  @ApiOkResponse({
    description: 'Access token with user profile (refresh token delivered as httpOnly cookie ck_refresh)',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        expiresIn: { type: 'number', example: 900 },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string', nullable: true },
            gender: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            role: { type: 'string' },
            isSuperAdmin: { type: 'boolean' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid OTP code', type: ApiErrorDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired code', type: ApiErrorDto })
  async verifyDashboardOtpEndpoint(
    @Body() dto: VerifyDashboardOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.verifyDashboardOtp.execute(dto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  // SECURITY (P0-12): tight throttle on the lookup oracle. Even though we now
  // return a constant response, throttle still bounds the cost-amplification
  // risk and limits any future regression that re-exposes the difference.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if a user exists and what auth methods are available (constant response; login is the authoritative path)' })
  @ApiOkResponse({
    description: 'User lookup result',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        hasPassword: { type: 'boolean' },
        identifier: { type: 'string' },
        channel: { type: 'string', enum: ['EMAIL', 'SMS'] },
      },
    },
  })
  async lookupEndpoint(@Body() dto: LookupUserDto) {
    return this.lookupUser.execute({ identifier: dto.identifier });
  }

  private setRefreshCookie(res: Response, token: string, rememberMe?: boolean): void {
    const ttlMs = this.parseTtlSeconds(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    ) * 1000;
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
    if (rememberMe) {
      cookieOptions.maxAge = ttlMs;
    }
    res.cookie('ck_refresh', token, cookieOptions);
  }

  private parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * multipliers[match[2]];
  }

  // Uses tokenSelector (first 8 chars of the raw UUID) as an indexed DB filter
  // so the bcrypt.compare runs on at most a handful of rows, not the full table.
  // The bcrypt.compare below is the actual identity check.
  private async findActiveToken(rawToken: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenSelector: selector, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) return c;
    }

    throw new UnauthorizedException('Invalid or expired refresh token');
  }
}
