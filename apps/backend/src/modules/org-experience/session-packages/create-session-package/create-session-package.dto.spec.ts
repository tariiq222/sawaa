import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiscountType } from '@prisma/client';
import { CreateSessionPackageDto } from './create-session-package.dto';
import { UpdateSessionPackageDto } from '../update-session-package/update-session-package.dto';
import { ListSessionPackagesDto } from '../list-session-packages/list-session-packages.dto';

const validateCreate = (plain: Record<string, unknown>) =>
  validate(plainToInstance(CreateSessionPackageDto, plain), { whitelist: true, forbidNonWhitelisted: true });

const validateUpdate = (plain: Record<string, unknown>) =>
  validate(plainToInstance(UpdateSessionPackageDto, plain), { whitelist: true, forbidNonWhitelisted: true });

const validateList = (plain: Record<string, unknown>) =>
  validate(plainToInstance(ListSessionPackagesDto, plain), { whitelist: true, forbidNonWhitelisted: true });

const validItem = {
  serviceId: '00000000-0000-4000-a000-000000000001',
  employeeId: '00000000-0000-4000-a000-000000000002',
  durationOptionId: '00000000-0000-4000-a000-000000000003',
  paidQuantity: 4,
  freeQuantity: 1,
};

const validCreate = () => ({
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  descriptionAr: 'أربع جلسات مع المعالج',
  descriptionEn: 'Four sessions with the practitioner',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  items: [validItem],
});

describe('CreateSessionPackageDto', () => {
  it('accepts a minimal valid payload', async () => {
    const errors = await validateCreate(validCreate());
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateCreate({
      ...validCreate(),
      imageUrl: 'https://cdn.example.com/pack.png',
      iconName: 'package',
      iconBgColor: '#FFD8A8',
      isActive: false,
      isPublic: true,
      sortOrder: 3,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts FIXED discountType', async () => {
    const errors = await validateCreate({ ...validCreate(), discountType: DiscountType.FIXED, discountValue: 50 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameAr', async () => {
    const errors = await validateCreate({ ...validCreate(), nameAr: undefined });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateCreate({ ...validCreate(), nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an empty items array', async () => {
    const errors = await validateCreate({ ...validCreate(), items: [] });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects a negative paidQuantity', async () => {
    const errors = await validateCreate({
      ...validCreate(),
      items: [{ ...validItem, paidQuantity: -1 }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects a non-UUID serviceId inside an item', async () => {
    const errors = await validateCreate({
      ...validCreate(),
      items: [{ ...validItem, serviceId: 'not-a-uuid' }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects a non-v4 UUID (default IsUUID behavior)', async () => {
    // class-validator IsUUID() defaults to 'all' but our v4 variants must match the spec.
    // Use an invalid UUID with a wrong version digit to verify the check fires.
    const errors = await validateCreate({
      ...validCreate(),
      items: [{ ...validItem, serviceId: '00000000-0000-0000-0000-000000000001' }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects a negative discountValue', async () => {
    const errors = await validateCreate({ ...validCreate(), discountValue: -1 });
    expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
  });

  it('rejects an unknown discountType enum value', async () => {
    const errors = await validateCreate({ ...validCreate(), discountType: 'WHATEVER' as unknown as DiscountType });
    expect(errors.some((e) => e.property === 'discountType')).toBe(true);
  });

  it('rejects unknown top-level fields (whitelist)', async () => {
    const errors = await validateCreate({ ...validCreate(), unexpected: 'bad' });
    expect(errors.some((e) => e.property === 'unexpected')).toBe(true);
  });
});

describe('UpdateSessionPackageDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial payload (nameAr only)', async () => {
    const errors = await validateUpdate({ nameAr: 'باقة محدّثة' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a full items replacement', async () => {
    const errors = await validateUpdate({ items: [validItem] });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty items array when items is provided', async () => {
    const errors = await validateUpdate({ items: [] });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejects a negative discountValue', async () => {
    const errors = await validateUpdate({ discountValue: -5 });
    expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
  });

  it('rejects an unknown discountType enum value', async () => {
    const errors = await validateUpdate({ discountType: 'FOO' as unknown as DiscountType });
    expect(errors.some((e) => e.property === 'discountType')).toBe(true);
  });
});

describe('ListSessionPackagesDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateList({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateList({ page: 1, limit: 20, isActive: 'true', isPublic: 'false', search: 'family' });
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive string "true" to boolean true', async () => {
    const dto = plainToInstance(ListSessionPackagesDto, { isActive: 'true' });
    expect(dto.isActive).toBe(true);
  });

  it('coerces isPublic string "false" to boolean false', async () => {
    const dto = plainToInstance(ListSessionPackagesDto, { isPublic: 'false' });
    expect(dto.isPublic).toBe(false);
  });

  it('rejects a non-boolean isActive after coercion', async () => {
    const errors = await validateList({ isActive: 'maybe' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a search string longer than 100 chars', async () => {
    const errors = await validateList({ search: 'x'.repeat(101) });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects a negative page number', async () => {
    const errors = await validateList({ page: -1 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});