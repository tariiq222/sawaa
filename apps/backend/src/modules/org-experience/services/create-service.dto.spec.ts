import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';

const baseValid = {
  nameAr: 'قص الشعر',
  nameEn: 'Haircut',
  durationMins: 30,
  price: 12000,
  categoryId: '550e8400-e29b-41d4-a716-446655440000',
};

const errorsFor = async (overrides: Record<string, unknown>) => {
  const dto = plainToInstance(CreateServiceDto, { ...baseValid, ...overrides });
  return validate(dto);
};

describe('CreateServiceDto', () => {
  describe('happy path', () => {
    it('accepts a minimal valid payload (only required fields)', async () => {
      const errors = await errorsFor({});
      expect(errors).toHaveLength(0);
    });

    it('accepts a fully populated payload', async () => {
      const errors = await errorsFor({
        descriptionAr: 'وصف',
        descriptionEn: 'Description',
        currency: 'SAR',
        imageUrl: 'https://example.com/logo.png',
        isActive: true,
        isHidden: false,
        hidePriceOnBooking: false,
        hideDurationOnBooking: false,
        iconName: 'scissors-01',
        iconBgColor: '#F0F4FF',
        bufferMinutes: 10,
        minLeadMinutes: 60,
        maxAdvanceDays: 30,
        depositEnabled: false,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('required fields', () => {
    it('rejects a missing nameAr', async () => {
      const { nameAr: _ignored, ...rest } = baseValid;
      const dto = plainToInstance(CreateServiceDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
    });

    it('rejects a missing nameEn', async () => {
      const { nameEn: _ignored, ...rest } = baseValid;
      const dto = plainToInstance(CreateServiceDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
    });

    it('rejects a missing categoryId', async () => {
      const { categoryId: _ignored, ...rest } = baseValid;
      const dto = plainToInstance(CreateServiceDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
    });

    it('rejects an empty nameAr', async () => {
      const errors = await errorsFor({ nameAr: '' });
      expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
    });
  });

  describe('nameAr / nameEn length', () => {
    it('rejects a nameAr longer than 200 chars', async () => {
      const errors = await errorsFor({ nameAr: 'أ'.repeat(201) });
      expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
    });

    it('rejects a nameEn longer than 200 chars', async () => {
      const errors = await errorsFor({ nameEn: 'A'.repeat(201) });
      expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
    });

    it('accepts a nameAr at the boundary (exactly 200 chars)', async () => {
      const errors = await errorsFor({ nameAr: 'أ'.repeat(200) });
      expect(errors).toHaveLength(0);
    });
  });

  describe('durationMins', () => {
    it('rejects a duration < 1', async () => {
      const errors = await errorsFor({ durationMins: 0 });
      expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
    });

    it('rejects a non-integer duration', async () => {
      const errors = await errorsFor({ durationMins: 30.5 });
      expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
    });

    it('accepts a 1-minute duration', async () => {
      const errors = await errorsFor({ durationMins: 1 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('price — integer halalas', () => {
    it('rejects a non-integer price', async () => {
      const errors = await errorsFor({ price: 120.5 });
      expect(errors.some((e) => e.property === 'price')).toBe(true);
    });

    it('rejects a negative price', async () => {
      const errors = await errorsFor({ price: -1 });
      expect(errors.some((e) => e.property === 'price')).toBe(true);
    });

    it('accepts an integer halala price', async () => {
      const errors = await errorsFor({ price: 12000 });
      expect(errors.some((e) => e.property === 'price')).toBe(false);
    });

    it('accepts a zero price', async () => {
      const errors = await errorsFor({ price: 0 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('categoryId UUID', () => {
    it('rejects a non-UUID categoryId', async () => {
      const errors = await errorsFor({ categoryId: 'not-a-uuid' });
      expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
    });
  });

  describe('currency length', () => {
    it('rejects a currency longer than 8 chars', async () => {
      const errors = await errorsFor({ currency: 'A'.repeat(9) });
      expect(errors.some((e) => e.property === 'currency')).toBe(true);
    });
  });

  describe('booleans', () => {
    it('rejects a non-boolean isActive', async () => {
      const errors = await errorsFor({ isActive: 'yes' });
      expect(errors.some((e) => e.property === 'isActive')).toBe(true);
    });

    it('rejects a non-boolean isHidden', async () => {
      const errors = await errorsFor({ isHidden: 1 });
      expect(errors.some((e) => e.property === 'isHidden')).toBe(true);
    });

    it('rejects a non-boolean hidePriceOnBooking', async () => {
      const errors = await errorsFor({ hidePriceOnBooking: 'true' });
      expect(errors.some((e) => e.property === 'hidePriceOnBooking')).toBe(true);
    });

    it('rejects a non-boolean hideDurationOnBooking', async () => {
      const errors = await errorsFor({ hideDurationOnBooking: 0 });
      expect(errors.some((e) => e.property === 'hideDurationOnBooking')).toBe(true);
    });

    it('rejects a non-boolean depositEnabled', async () => {
      const errors = await errorsFor({ depositEnabled: 'false' });
      expect(errors.some((e) => e.property === 'depositEnabled')).toBe(true);
    });
  });

  describe('depositAmount — integer halalas', () => {
    it('rejects a missing depositAmount when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
    });

    it('rejects a non-integer depositAmount when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true, depositAmount: 50.25 });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
    });

    it('rejects a depositAmount < 1 when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true, depositAmount: 0 });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
    });

    it('accepts a valid integer depositAmount when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true, depositAmount: 5000 });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(false);
    });

    it('does not require depositAmount when deposit is disabled', async () => {
      const errors = await errorsFor({ depositEnabled: false });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(false);
    });
  });

  describe('buffer / lead / advance', () => {
    it('rejects a negative bufferMinutes', async () => {
      const errors = await errorsFor({ bufferMinutes: -1 });
      expect(errors.some((e) => e.property === 'bufferMinutes')).toBe(true);
    });

    it('rejects a negative minLeadMinutes', async () => {
      const errors = await errorsFor({ minLeadMinutes: -10 });
      expect(errors.some((e) => e.property === 'minLeadMinutes')).toBe(true);
    });

    it('rejects maxAdvanceDays < 1', async () => {
      const errors = await errorsFor({ maxAdvanceDays: 0 });
      expect(errors.some((e) => e.property === 'maxAdvanceDays')).toBe(true);
    });
  });

  describe('iconName / iconBgColor length', () => {
    it('rejects an iconName longer than 50 chars', async () => {
      const errors = await errorsFor({ iconName: 'A'.repeat(51) });
      expect(errors.some((e) => e.property === 'iconName')).toBe(true);
    });

    it('rejects an iconBgColor longer than 20 chars', async () => {
      const errors = await errorsFor({ iconBgColor: '#'.repeat(21) });
      expect(errors.some((e) => e.property === 'iconBgColor')).toBe(true);
    });
  });

  describe('@SanitizeText — HTML/JS stripping', () => {
    it('strips a script tag from nameAr', () => {
      const dto = plainToInstance(CreateServiceDto, {
        ...baseValid,
        nameAr: '<script>alert(1)</script>',
      });
      expect(dto.nameAr).toBe('alert(1)');
    });

    it('strips tags and trims surrounding whitespace', () => {
      const dto = plainToInstance(CreateServiceDto, {
        ...baseValid,
        nameEn: '  <b>Hair</b>cut  ',
      });
      expect(dto.nameEn).toBe('Haircut');
    });
  });
});
