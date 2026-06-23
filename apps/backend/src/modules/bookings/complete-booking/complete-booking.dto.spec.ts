import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteBookingDto } from './complete-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CompleteBookingDto, plain);
  return validate(dto);
}

describe('CompleteBookingDto', () => {
  it('accepts an empty payload (every field is optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a completionNotes string', async () => {
    const errors = await validateDto({ completionNotes: 'Session completed successfully' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string completionNotes', async () => {
    const errors = await validateDto({ completionNotes: 12345 });
    expect(errors.some((e) => e.property === 'completionNotes')).toBe(true);
  });

  it('accepts an empty-string completionNotes (IsString does not require MinLength)', async () => {
    const errors = await validateDto({ completionNotes: '' });
    expect(errors).toHaveLength(0);
  });
});
