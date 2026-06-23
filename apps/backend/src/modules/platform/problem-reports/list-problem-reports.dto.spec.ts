import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProblemReportStatus } from '@prisma/client';
import { ListProblemReportsDto } from './list-problem-reports.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListProblemReportsDto, plain);
  return validate(dto);
}

describe('ListProblemReportsDto', () => {
  it('accepts an empty payload (extends PaginationDto, all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts every ProblemReportStatus enum value', async () => {
    for (const status of Object.values(ProblemReportStatus)) {
      const errors = await validateDto({ status });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown status', async () => {
    const errors = await validateDto({ status: 'ARCHIVED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a non-enum string status', async () => {
    const errors = await validateDto({ status: 'open' });
    // 'open' is lowercase, not in the enum (which is uppercase) → reject
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
