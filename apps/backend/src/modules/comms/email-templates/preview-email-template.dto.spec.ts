import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PreviewEmailTemplateDto } from './preview-email-template.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(PreviewEmailTemplateDto, plain);
  return validate(dto);
}

describe('PreviewEmailTemplateDto', () => {
  it('accepts an empty payload (context is optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid context object', async () => {
    const errors = await validateDto({ context: { name: 'Fatima', date: '2026-04-17' } });
    expect(errors).toHaveLength(0);
  });

  it('accepts context as an empty object', async () => {
    const errors = await validateDto({ context: {} });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-object context (string)', async () => {
    const errors = await validateDto({ context: 'name=Fatima' });
    expect(errors.some((e) => e.property === 'context')).toBe(true);
  });

  it('rejects an array context', async () => {
    const errors = await validateDto({ context: ['name', 'Fatima'] });
    expect(errors.some((e) => e.property === 'context')).toBe(true);
  });
});
