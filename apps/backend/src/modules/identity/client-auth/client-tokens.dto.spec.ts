import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LogoutDto, RefreshTokenDto } from './client-tokens.dto';

async function validateDto<T extends object>(klass: new () => T, plain: Record<string, unknown>) {
  const dto = plainToInstance(klass, plain);
  return validate(dto);
}

describe('ClientTokens DTOs', () => {
  describe('RefreshTokenDto', () => {
    it('accepts a string refresh token', async () => {
      const errors = await validateDto(RefreshTokenDto, {
        refreshToken: 'a1b2c3d4-0000-1111-2222-333344445555',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts an empty payload (httpOnly cookie path)', async () => {
      const errors = await validateDto(RefreshTokenDto, {});
      expect(errors).toHaveLength(0);
    });

    it('accepts a missing refreshToken (optional)', async () => {
      const errors = await validateDto(RefreshTokenDto, {});
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(false);
    });

    it('accepts an explicit null (optional)', async () => {
      const errors = await validateDto(RefreshTokenDto, { refreshToken: null });
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(false);
    });

    it('rejects a numeric refresh token', async () => {
      const errors = await validateDto(RefreshTokenDto, { refreshToken: 12345 });
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });

    it('rejects a boolean refresh token', async () => {
      const errors = await validateDto(RefreshTokenDto, { refreshToken: true });
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });
  });

  describe('LogoutDto', () => {
    it('accepts a string refresh token', async () => {
      const errors = await validateDto(LogoutDto, {
        refreshToken: 'a1b2c3d4-0000-1111-2222-333344445555',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts an empty payload (httpOnly cookie path)', async () => {
      const errors = await validateDto(LogoutDto, {});
      expect(errors).toHaveLength(0);
    });

    it('rejects a numeric refresh token', async () => {
      const errors = await validateDto(LogoutDto, { refreshToken: 42 });
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });

    it('rejects an object refresh token', async () => {
      const errors = await validateDto(LogoutDto, { refreshToken: { hijack: true } });
      expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
    });
  });
});
