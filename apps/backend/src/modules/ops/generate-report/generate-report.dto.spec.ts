import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateReportDto } from './generate-report.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GenerateReportDto, plain);
  return validate(dto);
}

describe('GenerateReportDto', () => {
  const valid: Record<string, unknown> = {
    type: 'REVENUE',
    from: '2026-01-01',
    to: '2026-03-31',
  };

  it('accepts a valid payload with required fields only', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a full payload with all optional fields', async () => {
    const errors = await validateDto({
      ...valid,
      format: 'EXCEL',
      branchId: 'b1c2d3e4-f5a6-4789-abcd-ef1234567890',
      employeeId: 'a9b8c7d6-e5f4-4321-8edc-ba9876543210',
      requestedBy: 'admin@clinic.com',
      compareWithPrevious: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts every ReportType enum value', async () => {
    for (const type of ['REVENUE', 'ACTIVITY', 'BOOKINGS', 'EMPLOYEES', 'OVERVIEW', 'CLIENTS', 'SERVICES', 'RATINGS']) {
      const errors = await validateDto({ ...valid, type });
      expect(errors.some((e) => e.property === 'type')).toBe(false);
    }
  });

  it('rejects a ReportType outside the enum', async () => {
    const errors = await validateDto({ ...valid, type: 'BOGUS' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('accepts JSON and EXCEL formats', async () => {
    expect((await validateDto({ ...valid, format: 'JSON' })).some((e) => e.property === 'format')).toBe(false);
    expect((await validateDto({ ...valid, format: 'EXCEL' })).some((e) => e.property === 'format')).toBe(false);
  });

  it('rejects a format outside the enum', async () => {
    const errors = await validateDto({ ...valid, format: 'PDF' });
    expect(errors.some((e) => e.property === 'format')).toBe(true);
  });

  it('rejects a non-ISO from date string', async () => {
    const errors = await validateDto({ ...valid, from: 'not-a-date' });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a non-ISO to date string', async () => {
    const errors = await validateDto({ ...valid, to: 'not-a-date' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects a missing type', async () => {
    const errors = await validateDto({ from: valid.from, to: valid.to });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a missing from', async () => {
    const errors = await validateDto({ type: valid.type, to: valid.to });
    expect(errors.some((e) => e.property === 'from')).toBe(true);
  });

  it('rejects a missing to', async () => {
    const errors = await validateDto({ type: valid.type, from: valid.from });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ ...valid, employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a non-string requestedBy', async () => {
    const errors = await validateDto({ ...valid, requestedBy: 12345 });
    expect(errors.some((e) => e.property === 'requestedBy')).toBe(true);
  });

  it('rejects a non-boolean compareWithPrevious', async () => {
    const errors = await validateDto({ ...valid, compareWithPrevious: 'true' });
    expect(errors.some((e) => e.property === 'compareWithPrevious')).toBe(true);
  });
});
