import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendStaffMessageDto } from './send-staff-message.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendStaffMessageDto, plain);
  return validate(dto);
}

describe('SendStaffMessageDto', () => {
  it('accepts a valid body', async () => {
    const errors = await validateDto({ body: 'Your appointment is confirmed for tomorrow at 10 AM.' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty body', async () => {
    const errors = await validateDto({ body: '' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('accepts a whitespace-only body (IsNotEmpty rejects only "", null, undefined)', async () => {
    const errors = await validateDto({ body: '   ' });
    expect(errors.some((e) => e.property === 'body')).toBe(false);
  });

  it('rejects a missing body', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a non-string body', async () => {
    const errors = await validateDto({ body: { text: 'hi' } });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });
});
