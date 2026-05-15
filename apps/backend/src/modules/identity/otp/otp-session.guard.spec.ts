import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { OtpSessionGuard } from './otp-session.guard';
import { OtpSessionService } from './otp-session.service';
import { PrismaService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { OtpPurpose } from '@prisma/client';

describe('OtpSessionGuard', () => {
  let guard: OtpSessionGuard;
  let otpSessionService: OtpSessionService;
  let prisma: PrismaService;
  let cls: ClsService;

  const createContext = (authHeader?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: authHeader },
        }),
      }),
    } as any);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpSessionGuard,
        {
          provide: OtpSessionService,
          useValue: {
            verifySession: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            usedOtpSession: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn((fn: () => Promise<any>) => fn()),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<OtpSessionGuard>(OtpSessionGuard);
    otpSessionService = module.get<OtpSessionService>(OtpSessionService);
    prisma = module.get<PrismaService>(PrismaService);
    cls = module.get<ClsService>(ClsService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('missing authorization header throws UnauthorizedException', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      new UnauthorizedException('Missing OTP session token'),
    );
  });

  it('non-Bearer authorization throws UnauthorizedException', async () => {
    await expect(guard.canActivate(createContext('Basic abc'))).rejects.toThrow(
      new UnauthorizedException('Missing OTP session token'),
    );
  });

  it('invalid/expired token throws UnauthorizedException', async () => {
    (otpSessionService.verifySession as jest.Mock).mockReturnValue(null);

    await expect(guard.canActivate(createContext('Bearer bad-token'))).rejects.toThrow(
      new UnauthorizedException('Invalid or expired OTP session'),
    );
  });

  it('wrong purpose throws UnauthorizedException', async () => {
    (otpSessionService.verifySession as jest.Mock).mockReturnValue({
      jti: 'jti-1',
      purpose: OtpPurpose.DASHBOARD_LOGIN,
    });

    await expect(guard.canActivate(createContext('Bearer valid-token'))).rejects.toThrow(
      new UnauthorizedException('OTP session purpose mismatch'),
    );
  });

  it('already used OTP session throws UnauthorizedException', async () => {
    (otpSessionService.verifySession as jest.Mock).mockReturnValue({
      jti: 'jti-1',
      purpose: OtpPurpose.GUEST_BOOKING,
    });
    (prisma.usedOtpSession.findUnique as jest.Mock).mockResolvedValue({ jti: 'jti-1' });

    await expect(guard.canActivate(createContext('Bearer valid-token'))).rejects.toThrow(
      new UnauthorizedException('OTP session already used'),
    );
  });

  it('valid token returns true and attaches payload to request', async () => {
    const payload = {
      jti: 'jti-1',
      purpose: OtpPurpose.GUEST_BOOKING,
      organizationId: 'org-1',
      identifier: 'user@example.com',
    };
    (otpSessionService.verifySession as jest.Mock).mockReturnValue(payload);
    (prisma.usedOtpSession.findUnique as jest.Mock).mockResolvedValue(null);

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.otpSession).toEqual(payload);
  });

  it('uses cls.run with SYSTEM_CONTEXT_CLS_KEY', async () => {
    const payload = {
      jti: 'jti-1',
      purpose: OtpPurpose.GUEST_BOOKING,
    };
    (otpSessionService.verifySession as jest.Mock).mockReturnValue(payload);
    (prisma.usedOtpSession.findUnique as jest.Mock).mockResolvedValue(null);

    const request: any = { headers: { authorization: 'Bearer valid-token' } };
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    await guard.canActivate(context);

    expect(cls.run).toHaveBeenCalledWith(expect.any(Function));
    expect(cls.set).toHaveBeenCalledWith(SYSTEM_CONTEXT_CLS_KEY, true);
  });

  it('verifies session via OtpSessionService.verifySession', async () => {
    const payload = {
      jti: 'jti-1',
      purpose: OtpPurpose.GUEST_BOOKING,
    };
    (otpSessionService.verifySession as jest.Mock).mockReturnValue(payload);
    (prisma.usedOtpSession.findUnique as jest.Mock).mockResolvedValue(null);

    const request: any = { headers: { authorization: 'Bearer my-token' } };
    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    await guard.canActivate(context);

    expect(otpSessionService.verifySession).toHaveBeenCalledWith('my-token');
  });
});
