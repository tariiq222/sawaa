import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeExceptionDto } from './create-employee-exception.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmployeeExceptionDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  startDate: '2026-05-01T09:00:00.000Z',
  endDate: '2026-05-07T09:00:00.000Z',
};

describe('CreateEmployeeExceptionDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      ...validPayload,
      endTime: '2026-05-07T14:00:00.000Z',
      isStartTimeOnly: true,
      reason: 'Annual vacation',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing startDate', async () => {
    const errors = await validateDto({ endDate: '2026-05-07T09:00:00.000Z' });
    expect(errors.some((e) => e.property === 'startDate')).toBe(true);
  });

  it('rejects a missing endDate', async () => {
    const errors = await validateDto({ startDate: '2026-05-01T09:00:00.000Z' });
    expect(errors.some((e) => e.property === 'endDate')).toBe(true);
  });

  it('rejects a non-ISO startDate', async () => {
    const errors = await validateDto({ ...validPayload, startDate: 'not-a-date' });
    expect(errors.some((e) => e.property === 'startDate')).toBe(true);
  });

  it('rejects a non-ISO endDate', async () => {
    const errors = await validateDto({ ...validPayload, endDate: '05/07/2026' });
    expect(errors.some((e) => e.property === 'endDate')).toBe(true);
  });

  it('rejects a non-ISO endTime', async () => {
    const errors = await validateDto({ ...validPayload, endTime: 'two oclock' });
    expect(errors.some((e) => e.property === 'endTime')).toBe(true);
  });

  it('rejects a non-boolean isStartTimeOnly', async () => {
    const errors = await validateDto({ ...validPayload, isStartTimeOnly: 'true' });
    expect(errors.some((e) => e.property === 'isStartTimeOnly')).toBe(true);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ ...validPayload, reason: 42 });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
