import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { OtpSessionService } from './otp-session.service';
import { OtpChannel, OtpPurpose } from '@prisma/client';

const buildModule = (envOverrides: Record<string, string | undefined> = {}) =>
  Test.createTestingModule({
    providers: [
      OtpSessionService,
      { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() } },
      {
        provide: ConfigService,
        useValue: { get: (key: string) => envOverrides[key] },
      },
    ],
  }).compile();

describe('OtpSessionService', () => {
  describe('signSession — JWT_OTP_SECRET set', () => {
    it('signs with JWT_OTP_SECRET when set', async () => {
      const module = await buildModule({ JWT_OTP_SECRET: 'otp-secret-xyz' });
      const svc = module.get(OtpSessionService);
      const jwt = module.get(JwtService) as jest.Mocked<JwtService>;

      await svc.signSession({
        organizationId: null,
        identifier: 'u@c.sa',
        purpose: OtpPurpose.GUEST_BOOKING,
        channel: OtpChannel.EMAIL,
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'u@c.sa' }),
        expect.objectContaining({ secret: 'otp-secret-xyz' }),
      );
    });
  });

  describe('signSession — JWT_OTP_SECRET absent (fallback)', () => {
    it('falls back to JWT_ACCESS_SECRET and warns', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const module = await buildModule({ JWT_ACCESS_SECRET: 'access-secret-abc' });
      const svc = module.get(OtpSessionService);
      const jwt = module.get(JwtService) as jest.Mocked<JwtService>;

      await svc.signSession({
        organizationId: null,
        identifier: 'u@c.sa',
        purpose: OtpPurpose.GUEST_BOOKING,
        channel: OtpChannel.EMAIL,
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ secret: 'access-secret-abc' }),
      );
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('verifySession — JWT_OTP_SECRET set', () => {
    it('verifies with JWT_OTP_SECRET', async () => {
      const module = await buildModule({ JWT_OTP_SECRET: 'otp-secret-xyz' });
      const svc = module.get(OtpSessionService);
      const jwt = module.get(JwtService) as jest.Mocked<JwtService>;
      jwt.verify.mockReturnValue({ identifier: 'u@c.sa' } as never);

      svc.verifySession('some-token');

      expect(jwt.verify).toHaveBeenCalledWith('some-token', expect.objectContaining({ secret: 'otp-secret-xyz' }));
    });
  });

  describe('verifySession — JWT_OTP_SECRET absent (fallback)', () => {
    it('falls back to JWT_ACCESS_SECRET on verify', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const module = await buildModule({ JWT_ACCESS_SECRET: 'access-secret-abc' });
      const svc = module.get(OtpSessionService);
      const jwt = module.get(JwtService) as jest.Mocked<JwtService>;
      jwt.verify.mockReturnValue({ identifier: 'u@c.sa' } as never);

      svc.verifySession('some-token');

      expect(jwt.verify).toHaveBeenCalledWith('some-token', expect.objectContaining({ secret: 'access-secret-abc' }));
      warnSpy.mockRestore();
    });

    it('returns null on verify error', async () => {
      const module = await buildModule({ JWT_OTP_SECRET: 'otp-secret-xyz' });
      const svc = module.get(OtpSessionService);
      const jwt = module.get(JwtService) as jest.Mocked<JwtService>;
      jwt.verify.mockImplementation(() => { throw new Error('expired'); });

      expect(svc.verifySession('bad-token')).toBeNull();
    });
  });
});
