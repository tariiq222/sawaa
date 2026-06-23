import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProblemReportType } from '@prisma/client';
import { CreateProblemReportDto } from './create-problem-report.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateProblemReportDto, plain);
  return validate(dto);
}

describe('CreateProblemReportDto', () => {
  const valid: Record<string, unknown> = {
    reporterId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    type: ProblemReportType.BUG,
    title: 'Booking page crashes on submit',
    description: 'When clicking the confirm button on the booking form, the page throws a 500 error.',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID reporterId', async () => {
    const errors = await validateDto({ ...valid, reporterId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'reporterId')).toBe(true);
  });

  it('rejects a missing reporterId', async () => {
    const errors = await validateDto({
      type: valid.type,
      title: valid.title,
      description: valid.description,
    });
    expect(errors.some((e) => e.property === 'reporterId')).toBe(true);
  });

  it('accepts every ProblemReportType enum value', async () => {
    for (const type of Object.values(ProblemReportType)) {
      const errors = await validateDto({ ...valid, type });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown type', async () => {
    const errors = await validateDto({ ...valid, type: 'SPAM' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a missing type', async () => {
    const errors = await validateDto({
      reporterId: valid.reporterId,
      title: valid.title,
      description: valid.description,
    });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  describe('title (IsString + MinLength(3))', () => {
    it('accepts a 3-char title (lower bound)', async () => {
      const errors = await validateDto({ ...valid, title: 'abc' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a 2-char title', async () => {
      const errors = await validateDto({ ...valid, title: 'ab' });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
    it('rejects a non-string title', async () => {
      const errors = await validateDto({ ...valid, title: 42 });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
    it('rejects a missing title', async () => {
      const errors = await validateDto({
        reporterId: valid.reporterId,
        type: valid.type,
        description: valid.description,
      });
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
  });

  describe('description (IsString + MinLength(10))', () => {
    it('accepts a 10-char description (lower bound)', async () => {
      const errors = await validateDto({ ...valid, description: '1234567890' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a 9-char description', async () => {
      const errors = await validateDto({ ...valid, description: '123456789' });
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });
    it('rejects a non-string description', async () => {
      const errors = await validateDto({ ...valid, description: { text: 'x' } });
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });
    it('rejects a missing description', async () => {
      const errors = await validateDto({
        reporterId: valid.reporterId,
        type: valid.type,
        title: valid.title,
      });
      expect(errors.some((e) => e.property === 'description')).toBe(true);
    });
  });
});
