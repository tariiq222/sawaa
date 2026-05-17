import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';

const baseValid = {
  nameAr: 'قص الشعر',
  durationMins: 30,
  price: 12000,
};

const errorsFor = async (overrides: Record<string, unknown>) => {
  const dto = plainToInstance(CreateServiceDto, { ...baseValid, ...overrides });
  return validate(dto);
};

describe('CreateServiceDto', () => {
  it('should be defined', () => {
    const dto = new CreateServiceDto();
    expect(dto).toBeDefined();
  });

  describe('price — integer halalas', () => {
    it('rejects a non-integer price', async () => {
      const errors = await errorsFor({ price: 120.5 });
      expect(errors.some((e) => e.property === 'price')).toBe(true);
    });

    it('accepts an integer halala price', async () => {
      const errors = await errorsFor({ price: 12000 });
      expect(errors.some((e) => e.property === 'price')).toBe(false);
    });
  });

  describe('depositAmount — integer halalas', () => {
    it('rejects a non-integer depositAmount when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true, depositAmount: 50.25 });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
    });

    it('accepts an integer halala depositAmount when deposit is enabled', async () => {
      const errors = await errorsFor({ depositEnabled: true, depositAmount: 5000 });
      expect(errors.some((e) => e.property === 'depositAmount')).toBe(false);
    });
  });
});
