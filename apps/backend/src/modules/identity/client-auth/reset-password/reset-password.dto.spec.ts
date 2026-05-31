import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResetPasswordDto } from './reset-password.dto';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(ResetPasswordDto, plain);
  return validate(instance);
}

const validPayload: Record<string, unknown> = {
  sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
  newPassword: 'NewSecurePass1',
};

describe('ResetPasswordDto', () => {
  it('should be defined', () => {
    const dto = new ResetPasswordDto();
    expect(dto).toBeDefined();
  });

  it('passes validation for a valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a password at the 200-char upper bound', async () => {
    const atLimit = 'Aa1' + 'x'.repeat(197); // 200 chars, satisfies upper/digit rules
    expect(atLimit).toHaveLength(200);
    const errors = await validateDto({ ...validPayload, newPassword: atLimit });
    expect(errors).toHaveLength(0);
  });

  it('rejects a password longer than 200 chars (DoS guard)', async () => {
    const tooLong = 'Aa1' + 'x'.repeat(198); // 201 chars
    expect(tooLong).toHaveLength(201);
    const errors = await validateDto({ ...validPayload, newPassword: tooLong });
    expect(errors.length).toBeGreaterThan(0);
    const passwordError = errors.find((e) => e.property === 'newPassword');
    expect(passwordError?.constraints).toHaveProperty('maxLength');
  });
});
