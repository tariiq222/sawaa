import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

const base = {
  branchId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  employeeId: '33333333-3333-4333-8333-333333333333',
  serviceId: '44444444-4444-4444-8444-444444444444',
  scheduledAt: '2026-06-18T10:00:00.000Z',
};

const build = (raw: Record<string, unknown>) =>
  plainToInstance(CreateBookingDto, { ...base, ...raw });

describe('CreateBookingDto', () => {
  it('accepts the required fields only', async () => {
    const errors = await validate(build({}));
    expect(errors).toHaveLength(0);
  });

  describe('UUID fields', () => {
    it('rejects a non-UUID branchId', async () => {
      const errors = await validate(build({ branchId: 'bad' }));
      expect(errors.some((e) => e.property === 'branchId')).toBe(true);
    });
    it('rejects a non-UUID clientId', async () => {
      const errors = await validate(build({ clientId: 'bad' }));
      expect(errors.some((e) => e.property === 'clientId')).toBe(true);
    });
    it('rejects a non-UUID employeeId', async () => {
      const errors = await validate(build({ employeeId: 'bad' }));
      expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
    });
    it('rejects a non-UUID serviceId', async () => {
      const errors = await validate(build({ serviceId: 'bad' }));
      expect(errors.some((e) => e.property === 'serviceId')).toBe(true);
    });
  });

  describe('scheduledAt (IsDateString)', () => {
    it('rejects a non-date string', async () => {
      const errors = await validate(build({ scheduledAt: 'not-a-date' }));
      expect(errors.some((e) => e.property === 'scheduledAt')).toBe(true);
    });
    it('rejects a missing scheduledAt', async () => {
      const { scheduledAt, ...rest } = base;
      const dto = plainToInstance(CreateBookingDto, rest);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'scheduledAt')).toBe(true);
    });
  });

  describe('durationOptionId (optional UUID; empty string coerces to undefined)', () => {
    it('accepts an empty string by transforming to undefined', async () => {
      const dto = build({ durationOptionId: '' });
      expect(dto.durationOptionId).toBeUndefined();
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-UUID value', async () => {
      const errors = await validate(build({ durationOptionId: 'not-a-uuid' }));
      expect(errors.some((e) => e.property === 'durationOptionId')).toBe(true);
    });
  });

  describe('currency (optional IsString)', () => {
    it('accepts a 3-letter code', async () => {
      const errors = await validate(build({ currency: 'SAR' }));
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-string (object — enableImplicitConversion cannot coerce)', async () => {
      const errors = await validate(build({ currency: { iso: 'SAR' } }));
      expect(errors.some((e) => e.property === 'currency')).toBe(true);
    });
  });

  describe('bookingType (Transform + IsString)', () => {
    it('uppercases a valid bookingType', async () => {
      const dto = build({ bookingType: 'walk_in' });
      expect(dto.bookingType).toBe('WALK_IN');
      expect(await validate(dto)).toHaveLength(0);
    });
    it('keeps "ONLINE" as-is (special-case for delivery-as-type)', async () => {
      const dto = build({ bookingType: 'ONLINE' });
      expect(dto.bookingType).toBe('ONLINE');
      expect(await validate(dto)).toHaveLength(0);
    });
  });

  describe('deliveryType (Transform + IsEnum(DeliveryType))', () => {
    it('accepts the snake_case deliveryType the dashboard sends and uppercases it', async () => {
      const inPerson = build({ deliveryType: 'in_person' });
      expect(inPerson.deliveryType).toBe('IN_PERSON');
      expect(await validate(inPerson)).toHaveLength(0);

      const online = build({ deliveryType: 'online' });
      expect(online.deliveryType).toBe('ONLINE');
      expect(await validate(online)).toHaveLength(0);
    });
    it('still rejects a genuinely invalid deliveryType', async () => {
      const bad = build({ deliveryType: 'teleport' });
      const errors = await validate(bad);
      expect(errors.some((e) => e.property === 'deliveryType')).toBe(true);
    });
  });

  describe('expiresAt (optional IsDateString)', () => {
    it('accepts a valid date', async () => {
      const errors = await validate(build({ expiresAt: '2026-05-01T12:00:00.000Z' }));
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-date', async () => {
      const errors = await validate(build({ expiresAt: 'soon' }));
      expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
    });
  });

  describe('payAtClinic (optional IsBoolean)', () => {
    it('accepts true and false', async () => {
      expect((await validate(build({ payAtClinic: true })))).toHaveLength(0);
      expect((await validate(build({ payAtClinic: false })))).toHaveLength(0);
    });
    it('rejects a non-boolean (array — enableImplicitConversion cannot coerce)', async () => {
      const errors = await validate(build({ payAtClinic: ['true'] }));
      expect(errors.some((e) => e.property === 'payAtClinic')).toBe(true);
    });
  });

  describe('couponCode (optional IsString)', () => {
    it('accepts a coupon code', async () => {
      const errors = await validate(build({ couponCode: 'SAVE10' }));
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-string (object — enableImplicitConversion cannot coerce)', async () => {
      const errors = await validate(build({ couponCode: { code: 'X' } }));
      expect(errors.some((e) => e.property === 'couponCode')).toBe(true);
    });
  });
});
