import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListBookingsDto } from './list-bookings.dto';

const build = (raw: Record<string, unknown>) =>
  plainToInstance(ListBookingsDto, raw);

describe('ListBookingsDto', () => {
  it('accepts an empty payload (extends PaginationDto, every field is optional)', async () => {
    const errors = await validate(build({}));
    expect(errors).toHaveLength(0);
  });

  describe('UUID filters', () => {
    const uuidFields = ['clientId', 'employeeId', 'branchId', 'serviceId'] as const;
    for (const field of uuidFields) {
      it(`rejects a non-UUID ${field}`, async () => {
        const errors = await validate(build({ [field]: 'bad-id' }));
        expect(errors.some((e) => e.property === field)).toBe(true);
      });
      it(`accepts a valid ${field} UUID`, async () => {
        const errors = await validate(
          build({ [field]: '11111111-1111-4111-8111-111111111111' }),
        );
        expect(errors).toHaveLength(0);
      });
    }
  });

  describe('status (Transform + IsEnum(BookingStatus))', () => {
    it('uppercases a lowercase status and validates', async () => {
      const dto = build({ status: 'confirmed' });
      expect(dto.status).toBe('CONFIRMED');
      expect(await validate(dto)).toHaveLength(0);
    });
    it('rejects an unknown status', async () => {
      const errors = await validate(build({ status: 'INVENTED' }));
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  describe('bookingType (Transform + IsEnum(BookingType))', () => {
    it('transforms snake_case deliveryType to the DB enum and validates', async () => {
      const dto = build({ deliveryType: 'online' });
      expect(dto.deliveryType).toBe('ONLINE');
      expect(await validate(dto)).toHaveLength(0);

      const inPerson = build({ deliveryType: 'in_person' });
      expect(inPerson.deliveryType).toBe('IN_PERSON');
      expect(await validate(inPerson)).toHaveLength(0);
    });
    it('uppercases bookingType and rejects "online" as a booking type', async () => {
      const ok = build({ bookingType: 'individual' });
      expect(ok.bookingType).toBe('INDIVIDUAL');
      expect(await validate(ok)).toHaveLength(0);

      // online is a delivery channel, never a booking type → must fail
      const bad = build({ bookingType: 'online' });
      const errors = await validate(bad);
      expect(errors.some((e) => e.property === 'bookingType')).toBe(true);
    });
  });

  describe('source (IsEnum(BookingSource))', () => {
    it('accepts RECEPTION and ONLINE', async () => {
      expect((await validate(build({ source: 'RECEPTION' })))).toHaveLength(0);
      expect((await validate(build({ source: 'ONLINE' })))).toHaveLength(0);
    });
    it('rejects an unknown source', async () => {
      const errors = await validate(build({ source: 'PHONE' }));
      expect(errors.some((e) => e.property === 'source')).toBe(true);
    });
  });

  describe('date range (IsDateString)', () => {
    it('accepts valid fromDate and toDate', async () => {
      const errors = await validate(
        build({
          fromDate: '2026-05-01T00:00:00.000Z',
          toDate: '2026-05-31T23:59:59.000Z',
        }),
      );
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-date fromDate', async () => {
      const errors = await validate(build({ fromDate: 'yesterday' }));
      expect(errors.some((e) => e.property === 'fromDate')).toBe(true);
    });
    it('rejects a non-date toDate', async () => {
      const errors = await validate(build({ toDate: 'tomorrow' }));
      expect(errors.some((e) => e.property === 'toDate')).toBe(true);
    });
  });

  describe('search (IsString + MaxLength(120))', () => {
    it('accepts a short string', async () => {
      const errors = await validate(build({ search: 'bkg-1' }));
      expect(errors).toHaveLength(0);
    });
    it('accepts a 120-char string (upper bound)', async () => {
      const errors = await validate(build({ search: 'x'.repeat(120) }));
      expect(errors).toHaveLength(0);
    });
    it('rejects a 121-char string', async () => {
      const errors = await validate(build({ search: 'x'.repeat(121) }));
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });
    it('rejects a non-string (object — enableImplicitConversion cannot coerce)', async () => {
      const errors = await validate(build({ search: { q: 'x' } }));
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });
  });

  describe('isGuest (Transform + IsBoolean)', () => {
    it('coerces the isGuest query string to a real boolean', async () => {
      const t = build({ isGuest: 'true' });
      expect(t.isGuest).toBe(true);
      expect(await validate(t)).toHaveLength(0);

      const f = build({ isGuest: 'false' });
      expect(f.isGuest).toBe(false);
      expect(await validate(f)).toHaveLength(0);
    });
    it('accepts a real boolean', async () => {
      expect((await validate(build({ isGuest: true })))).toHaveLength(0);
      expect((await validate(build({ isGuest: false })))).toHaveLength(0);
    });
  });
});
