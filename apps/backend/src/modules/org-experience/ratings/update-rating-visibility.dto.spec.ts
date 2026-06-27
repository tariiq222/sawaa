import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRatingVisibilityDto } from './update-rating-visibility.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateRatingVisibilityDto, plain);
  return validate(dto);
}

describe('UpdateRatingVisibilityDto', () => {
  // The rating id comes from the route param (ParseUUIDPipe), not the body.

  it('accepts a valid payload (isPublic = true)', async () => {
    const errors = await validateDto({ isPublic: true });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload (isPublic = false)', async () => {
    const errors = await validateDto({ isPublic: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing isPublic', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a non-boolean isPublic (string)', async () => {
    const errors = await validateDto({ isPublic: 'true' });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a non-boolean isPublic (number)', async () => {
    const errors = await validateDto({ isPublic: 1 });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });
});
