import { Controller, Post, Body, HttpCode, HttpStatus, Req, Ip, UseGuards, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { RegisterHandler } from '../../modules/identity/client-auth/register.handler';
import { RegisterDto } from '../../modules/identity/client-auth/register.dto';
import { ClientLoginHandler } from '../../modules/identity/client-auth/client-login.handler';
import { ClientLoginDto } from '../../modules/identity/client-auth/client-login.dto';
import { ClientRefreshHandler } from '../../modules/identity/client-auth/client-refresh.handler';
import { ClientLogoutHandler } from '../../modules/identity/client-auth/client-logout.handler';
import { RefreshTokenDto, LogoutDto } from '../../modules/identity/client-auth/client-tokens.dto';
import { ResetPasswordHandler } from '../../modules/identity/client-auth/reset-password/reset-password.handler';
import { ResetPasswordDto } from '../../modules/identity/client-auth/reset-password/reset-password.dto';
import { Request, Response } from 'express';

const ACCESS_COOKIE = 'client_access_token';
const REFRESH_COOKIE = 'client_refresh_token';
const isProd = process.env.NODE_ENV === 'production';

// sameSite 'lax' (both cookies) is REQUIRED, not an oversight: the Moyasar 3DS
// flow returns the client via a cross-site top-level GET redirect to the
// website's /booking/payment-callback → /booking/confirm, and the website
// middleware gates /booking/confirm on the client_access_token cookie. With
// 'strict' the browser would drop the cookies on that navigation and bounce
// the paying client to /login. 'lax' still withholds the cookies on cross-site
// non-GET requests, which is the CSRF protection that matters here.
function setAuthCookies(res: Response, accessToken: string, accessMaxAge: number, refreshToken: string, refreshMaxAge: number) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxAge,
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

function getRefreshTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE];
}

@ApiTags('Public / Auth')
@ApiPublicResponses()
@Controller('public/auth')
export class PublicAuthController {
  constructor(
    private readonly register: RegisterHandler,
    private readonly login: ClientLoginHandler,
    private readonly refresh: ClientRefreshHandler,
    private readonly logout: ClientLogoutHandler,
    private readonly resetPassword: ResetPasswordHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a new client account' })
  @ApiCreatedResponse({ schema: { type: 'object', description: 'Created client account with tokens' } })
  async registerEndpoint(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.register.execute(dto, req);
    setAuthCookies(res, result.accessToken, result.accessMaxAgeMs, result.refreshToken, result.refreshMaxAgeMs);
    return { clientId: result.clientId };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email or phone and password' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Auth tokens' } })
  async loginEndpoint(@Body() dto: ClientLoginDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.login.execute(dto, ip);
    setAuthCookies(res, result.accessToken, result.accessMaxAgeMs, result.refreshToken, result.refreshMaxAgeMs);
    return { clientId: result.clientId };
  }

  // @Public() exempts this route from the global staff JwtGuard (APP_GUARD);
  // ClientSessionGuard still enforces the client cookie session.
  @Public()
  @UseGuards(ClientSessionGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiOkResponse({ schema: { type: 'object', description: 'New access token' } })
  async refreshEndpoint(
    @Body() dto: RefreshTokenDto,
    @ClientSession() session: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = getRefreshTokenFromRequest(req);
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    const result = await this.refresh.execute(rawToken, session.id);
    setAuthCookies(res, result.accessToken, result.accessMaxAgeMs, result.refreshToken, result.refreshMaxAgeMs);
    return { clientId: session.id };
  }

  // @Public() exempts this route from the global staff JwtGuard (APP_GUARD);
  // ClientSessionGuard still enforces the client cookie session.
  @Public()
  @UseGuards(ClientSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Log out and revoke refresh token' })
  @ApiNoContentResponse()
  async logoutEndpoint(
    @Body() dto: LogoutDto,
    @ClientSession() session: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = getRefreshTokenFromRequest(req);
    if (rawToken) {
      await this.logout.execute(rawToken, session.id);
    }
    clearAuthCookies(res);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with OTP token' })
  @ApiNoContentResponse()
  async resetPasswordEndpoint(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPassword.execute(dto);
  }
}
