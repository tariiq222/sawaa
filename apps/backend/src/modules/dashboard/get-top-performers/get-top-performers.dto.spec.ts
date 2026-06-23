import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetTopPerformersDto } from './get-top-performers.dto';

async function validateDto(plain: Record<string, unknown>) {
  return validate(plainToInstance(GetTopPerformersDto, plain));
}

describe('GetTopPerformersDto', () => {
  it('defaults period to "month" when omitted', async () => {
    const dto = plainToInstance(GetTopPerformersDto, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.period).toBe('month');
  });

  it('accepts the allowed period value "month"', async () => {
    expect(await validateDto({ period: 'month' })).toHaveLength(0);
  });

  it('rejects a period outside the allowed set', async () => {
    const errors = await validateDto({ period: 'week' });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });

  it('rejects a non-string period', async () => {
    const errors = await validateDto({ period: 123 });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });
});
