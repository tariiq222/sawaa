import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRatingVisibilityDto } from './update-rating-visibility.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateRatingVisibilityDto, plain);
  return validate(dto);
}

describe('UpdateRatingVisibilityDto', () => {
  it('accepts a fully valid payload (isPublic = true)', async () => {
    const errors = await validateDto({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully valid payload (isPublic = false)', async () => {
    const errors = await validateDto({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing id', async () => {
    const errors = await validateDto({ isPublic: true });
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });

  it('rejects a missing isPublic', async () => {
    const errors = await validateDto({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a non-UUID id', async () => {
    const errors = await validateDto({ id: 'not-a-uuid', isPublic: true });
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });

  it('rejects a non-boolean isPublic (string)', async () => {
    const errors = await validateDto({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: 'true',
    });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a non-boolean isPublic (number)', async () => {
    const errors = await validateDto({
      id: '550e8400-e29b-41d4-a716-446655440000',
      isPublic: 1,
    });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });
});
