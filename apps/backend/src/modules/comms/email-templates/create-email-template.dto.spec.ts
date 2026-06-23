import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmailTemplateDto } from './create-email-template.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmailTemplateDto, plain);
  return validate(dto);
}

describe('CreateEmailTemplateDto', () => {
  const valid: Record<string, unknown> = {
    slug: 'booking-confirmed',
    name: 'تأكيد الحجز',
    subject: 'تم تأكيد حجزك',
    htmlBody: '<p>Hello {{name}}</p>',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional blocks field', async () => {
    const errors = await validateDto({ ...valid, blocks: [{ type: 'paragraph' }] });
    expect(errors).toHaveLength(0);
  });

  it('accepts blocks omitted (optional)', async () => {
    const errors = await validateDto(valid);
    expect(errors.some((e) => e.property === 'blocks')).toBe(false);
  });

  it('rejects a missing slug', async () => {
    const errors = await validateDto({
      name: valid.name,
      subject: valid.subject,
      htmlBody: valid.htmlBody,
    });
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });

  it('rejects a slug shorter than 2 chars', async () => {
    const errors = await validateDto({ ...valid, slug: 'a' });
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });

  it('rejects a slug longer than 64 chars', async () => {
    const errors = await validateDto({ ...valid, slug: 'a'.repeat(65) });
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });

  it('accepts a slug at the MaxLength(64) boundary', async () => {
    const errors = await validateDto({ ...valid, slug: 'a'.repeat(64) });
    expect(errors.some((e) => e.property === 'slug')).toBe(false);
  });

  it('rejects a name containing CR/LF (header-injection guard)', async () => {
    const errors = await validateDto({ ...valid, name: 'Name\r\nBcc: attacker' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a subject containing CR/LF (header-injection guard)', async () => {
    const errors = await validateDto({ ...valid, subject: 'Subj\r\nBcc: attacker' });
    expect(errors.some((e) => e.property === 'subject')).toBe(true);
  });

  it('rejects an empty name', async () => {
    const errors = await validateDto({ ...valid, name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a missing htmlBody', async () => {
    const errors = await validateDto({
      slug: valid.slug,
      name: valid.name,
      subject: valid.subject,
    });
    expect(errors.some((e) => e.property === 'htmlBody')).toBe(true);
  });
});
