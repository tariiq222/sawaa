import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmailTemplateDto } from './update-email-template.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateEmailTemplateDto, plain);
  return validate(dto);
}

describe('UpdateEmailTemplateDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial payload (name only)', async () => {
    const errors = await validateDto({ name: 'اسم جديد' });
    expect(errors).toHaveLength(0);
  });

  it('accepts isActive as a boolean', async () => {
    const errors = await validateDto({ isActive: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects isActive with a non-boolean value', async () => {
    const errors = await validateDto({ isActive: 'false' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects name containing CR/LF (header-injection guard)', async () => {
    const errors = await validateDto({ name: 'evil\r\nattacker' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an empty name when provided', async () => {
    const errors = await validateDto({ name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 200 chars', async () => {
    const errors = await validateDto({ name: 'ا'.repeat(201) });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('accepts a name at the MaxLength(200) boundary', async () => {
    const errors = await validateDto({ name: 'ا'.repeat(200) });
    expect(errors.some((e) => e.property === 'name')).toBe(false);
  });

  it('rejects subject containing CR/LF', async () => {
    const errors = await validateDto({ subject: 'bad\r\nheader' });
    expect(errors.some((e) => e.property === 'subject')).toBe(true);
  });

  it('accepts a subject at the MaxLength(300) boundary', async () => {
    const errors = await validateDto({ subject: 'س'.repeat(300) });
    expect(errors.some((e) => e.property === 'subject')).toBe(false);
  });
});
