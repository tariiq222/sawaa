import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BreakWindowDto, SetEmployeeBreaksDto } from './set-employee-breaks.dto';

async function validateDto(plain: Record<string, unknown>, Cls = SetEmployeeBreaksDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

describe('SetEmployeeBreaksDto', () => {
  it('accepts a valid breaks list', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts multiple break windows across the week', async () => {
    const errors = await validateDto({
      breaks: [
        { dayOfWeek: 1, startTime: '12:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '15:30', endTime: '15:45' },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing breaks array', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'breaks')).toBe(true);
  });

  it('rejects a non-array breaks field', async () => {
    const errors = await validateDto({ breaks: 'not-an-array' });
    expect(errors.some((e) => e.property === 'breaks')).toBe(true);
  });

  it('accepts an empty breaks array (clears all breaks)', async () => {
    const errors = await validateDto({ breaks: [] });
    expect(errors).toHaveLength(0);
  });

  it('rejects a break with dayOfWeek < 0', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: -1, startTime: '12:00', endTime: '13:00' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });

  it('rejects a break with dayOfWeek > 6', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 7, startTime: '12:00', endTime: '13:00' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });

  it('rejects a startTime that is not HH:MM', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 1, startTime: '12:00:00', endTime: '13:00' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });

  it('rejects an endTime that is not HH:MM', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: 'noon' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });

  it('rejects a 24:00 time (hour 24 not allowed)', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 1, startTime: '24:00', endTime: '25:00' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });

  it('rejects a break with a non-integer dayOfWeek', async () => {
    const errors = await validateDto({
      breaks: [{ dayOfWeek: 1.5, startTime: '12:00', endTime: '13:00' }],
    });
    const breakErrors = errors.filter((e) => e.property === 'breaks');
    expect(breakErrors.length).toBeGreaterThan(0);
  });
});

describe('BreakWindowDto', () => {
  it('accepts a fully valid BreakWindow instance', async () => {
    const errors = await validateDto(
      { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
      BreakWindowDto,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a BreakWindow with missing startTime', async () => {
    const errors = await validateDto({ dayOfWeek: 0, endTime: '10:00' }, BreakWindowDto);
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });
});
