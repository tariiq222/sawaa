import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPublicTestimonialsDto } from './list-public-testimonials.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListPublicTestimonialsDto, plain);
  return validate(dto);
}

describe('ListPublicTestimonialsDto', () => {
  it('accepts an empty payload (default limit applies)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces limit from string to integer', async () => {
    const dto = plainToInstance(ListPublicTestimonialsDto, { limit: '10' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
  });

  it('rejects limit < 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit > 20', async () => {
    const errors = await validateDto({ limit: 21 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit at the upper boundary (exactly 20)', async () => {
    const errors = await validateDto({ limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('accepts limit at the lower boundary (exactly 1)', async () => {
    const errors = await validateDto({ limit: 1 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-integer limit', async () => {
    const errors = await validateDto({ limit: 1.5 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
