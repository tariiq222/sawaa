import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitRatingDto } from './submit-rating.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SubmitRatingDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  bookingId: '550e8400-e29b-41d4-a716-446655440000',
  clientId: '550e8400-e29b-41d4-a716-446655440001',
  employeeId: '550e8400-e29b-41d4-a716-446655440002',
  score: 5,
};

describe('SubmitRatingDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      ...validPayload,
      comment: 'Great service!',
      isPublic: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing bookingId', async () => {
    const { bookingId: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
  });

  it('rejects a missing clientId', async () => {
    const { clientId: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('rejects a missing employeeId', async () => {
    const { employeeId: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a missing score', async () => {
    const { score: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'score')).toBe(true);
  });

  it('rejects a non-UUID bookingId', async () => {
    const errors = await validateDto({ ...validPayload, bookingId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'bookingId')).toBe(true);
  });

  it('rejects a non-UUID clientId', async () => {
    const errors = await validateDto({ ...validPayload, clientId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ ...validPayload, employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a score < 1', async () => {
    const errors = await validateDto({ ...validPayload, score: 0 });
    expect(errors.some((e) => e.property === 'score')).toBe(true);
  });

  it('rejects a score > 5', async () => {
    const errors = await validateDto({ ...validPayload, score: 6 });
    expect(errors.some((e) => e.property === 'score')).toBe(true);
  });

  it('rejects a non-integer score', async () => {
    const errors = await validateDto({ ...validPayload, score: 3.5 });
    expect(errors.some((e) => e.property === 'score')).toBe(true);
  });

  it('accepts each valid score 1..5', async () => {
    for (const score of [1, 2, 3, 4, 5]) {
      const errors = await validateDto({ ...validPayload, score });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a comment longer than 2000 chars', async () => {
    const errors = await validateDto({ ...validPayload, comment: 'A'.repeat(2001) });
    expect(errors.some((e) => e.property === 'comment')).toBe(true);
  });

  it('rejects a non-string comment', async () => {
    const errors = await validateDto({ ...validPayload, comment: 42 });
    expect(errors.some((e) => e.property === 'comment')).toBe(true);
  });

  it('rejects a non-boolean isPublic', async () => {
    const errors = await validateDto({ ...validPayload, isPublic: 'true' });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });
});
