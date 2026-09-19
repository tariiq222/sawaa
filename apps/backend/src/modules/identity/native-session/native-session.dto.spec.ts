import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NativeSessionDto } from './native-session.dto';

describe('NativeSessionDto', () => {
  const validateDto = (value: Record<string, unknown>) =>
    validate(plainToInstance(NativeSessionDto, value));

  it('accepts a bounded refresh token string', async () => {
    await expect(
      validateDto({ refreshToken: 'a1b2c3d4-0000-1111-2222-333344445555' }),
    ).resolves.toHaveLength(0);
  });

  it('rejects a missing or empty refresh token', async () => {
    await expect(validateDto({})).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'refreshToken' })]),
    );
    await expect(validateDto({ refreshToken: '' })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'refreshToken' })]),
    );
  });

  it('rejects non-string and overlong refresh tokens', async () => {
    await expect(validateDto({ refreshToken: 42 })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'refreshToken' })]),
    );
    await expect(validateDto({ refreshToken: 'x'.repeat(257) })).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'refreshToken' })]),
    );
  });
});
