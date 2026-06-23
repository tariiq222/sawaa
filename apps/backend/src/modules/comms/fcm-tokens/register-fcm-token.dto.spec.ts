import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterFcmTokenDto } from './register-fcm-token.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RegisterFcmTokenDto, plain);
  return validate(dto);
}

describe('RegisterFcmTokenDto', () => {
  const valid: Record<string, unknown> = {
    token: 'eXampleToken123',
    platform: 'ios',
  };

  it('accepts a valid ios token', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid android token', async () => {
    const errors = await validateDto({ ...valid, platform: 'android' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a token at the MaxLength(512) boundary', async () => {
    const atLimit = 'a'.repeat(512);
    const errors = await validateDto({ ...valid, token: atLimit });
    expect(errors.some((e) => e.property === 'token')).toBe(false);
  });

  it('rejects a token exceeding MaxLength(512)', async () => {
    const tooLong = 'a'.repeat(513);
    const errors = await validateDto({ ...valid, token: tooLong });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects an empty token', async () => {
    const errors = await validateDto({ ...valid, token: '' });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a missing token', async () => {
    const errors = await validateDto({ platform: valid.platform });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a platform outside the allowed enum', async () => {
    const errors = await validateDto({ ...valid, platform: 'windows' });
    expect(errors.some((e) => e.property === 'platform')).toBe(true);
  });

  it('rejects a missing platform', async () => {
    const errors = await validateDto({ token: valid.token });
    expect(errors.some((e) => e.property === 'platform')).toBe(true);
  });
});
