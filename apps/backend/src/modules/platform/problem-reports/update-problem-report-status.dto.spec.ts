import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProblemReportStatus } from '@prisma/client';
import { UpdateProblemReportStatusDto } from './update-problem-report-status.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProblemReportStatusDto, plain);
  return validate(dto);
}

describe('UpdateProblemReportStatusDto', () => {
  it('accepts a valid status with no resolution', async () => {
    const errors = await validateDto({ status: ProblemReportStatus.RESOLVED });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid status with a resolution string', async () => {
    const errors = await validateDto({
      status: ProblemReportStatus.RESOLVED,
      resolution: 'Fixed in v1.4.2 — invalid form state was not cleared on re-render.',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts every ProblemReportStatus enum value', async () => {
    for (const status of Object.values(ProblemReportStatus)) {
      const errors = await validateDto({ status });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a missing status', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects an unknown status', async () => {
    const errors = await validateDto({ status: 'ARCHIVED' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects a non-string resolution', async () => {
    const errors = await validateDto({
      status: ProblemReportStatus.RESOLVED,
      resolution: { text: 'x' },
    });
    expect(errors.some((e) => e.property === 'resolution')).toBe(true);
  });
});
