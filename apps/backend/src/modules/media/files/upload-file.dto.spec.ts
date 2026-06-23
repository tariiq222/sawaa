import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadFileDto } from './upload-file.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UploadFileDto, plain);
  return validate(dto);
}

describe('UploadFileDto', () => {
  it('accepts an empty payload (all metadata fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a full payload', async () => {
    const errors = await validateDto({
      visibility: 'PUBLIC',
      ownerType: 'Employee',
      ownerId: '12345678-1234-4234-8234-123456789abc',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts PRIVATE visibility', async () => {
    const errors = await validateDto({ visibility: 'PRIVATE' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a visibility outside the enum', async () => {
    const errors = await validateDto({ visibility: 'INTERNAL' });
    expect(errors.some((e) => e.property === 'visibility')).toBe(true);
  });

  it('rejects a lowercase visibility', async () => {
    const errors = await validateDto({ visibility: 'public' });
    expect(errors.some((e) => e.property === 'visibility')).toBe(true);
  });

  it('accepts ownerType at the MaxLength(32) boundary', async () => {
    const errors = await validateDto({ ownerType: 'a'.repeat(32) });
    expect(errors.some((e) => e.property === 'ownerType')).toBe(false);
  });

  it('rejects ownerType longer than 32 chars', async () => {
    const errors = await validateDto({ ownerType: 'a'.repeat(33) });
    expect(errors.some((e) => e.property === 'ownerType')).toBe(true);
  });

  it('rejects a non-string ownerType', async () => {
    const errors = await validateDto({ ownerType: 12345 });
    expect(errors.some((e) => e.property === 'ownerType')).toBe(true);
  });

  it('rejects a non-UUID ownerId', async () => {
    const errors = await validateDto({ ownerId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'ownerId')).toBe(true);
  });

  it('ignores uploadedBy impersonation attempts (security comment in DTO)', async () => {
    // uploadedBy is set server-side from JWT — must not be accepted from the
    // request body. The DTO has no such field, so an unknown extra key is
    // ignored by class-transformer.
    const errors = await validateDto({ uploadedBy: 'attacker@example.com' });
    expect(errors).toHaveLength(0);
  });
});
