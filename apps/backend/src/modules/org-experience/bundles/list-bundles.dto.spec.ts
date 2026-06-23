import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListBundlesDto } from './list-bundles.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListBundlesDto, plain);
  return validate(dto);
}

describe('ListBundlesDto', () => {
  it('accepts an empty payload (all filters optional, pagination defaults)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean true', async () => {
    const dto = plainToInstance(ListBundlesDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" to boolean false', async () => {
    const dto = plainToInstance(ListBundlesDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('rejects a non-boolean isActive (string that is not "true"/"false")', async () => {
    const errors = await validateDto({ isActive: 'maybe' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('coerces includeHidden = "1" to boolean true', async () => {
    const dto = plainToInstance(ListBundlesDto, { includeHidden: '1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.includeHidden).toBe(true);
  });

  it('rejects a non-boolean includeHidden', async () => {
    const errors = await validateDto({ includeHidden: 'maybe' });
    expect(errors.some((e) => e.property === 'includeHidden')).toBe(true);
  });

  it('accepts a search string', async () => {
    const errors = await validateDto({ search: 'عناية' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a search longer than 100 chars', async () => {
    const errors = await validateDto({ search: 'A'.repeat(101) });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects a non-string search', async () => {
    const errors = await validateDto({ search: 42 });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('coerces page from string to integer', async () => {
    const dto = plainToInstance(ListBundlesDto, { page: '2' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit > 200', async () => {
    const errors = await validateDto({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
