import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListBookingsDto } from './list-bookings.dto';

const build = (raw: Record<string, unknown>) =>
  plainToInstance(ListBookingsDto, raw, { enableImplicitConversion: true });

describe('ListBookingsDto', () => {
  it('should instantiate', () => {
    expect(new ListBookingsDto()).toBeDefined();
  });

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

  it('coerces the isGuest query string to a real boolean', async () => {
    const t = build({ isGuest: 'true' });
    expect(t.isGuest).toBe(true);
    expect(await validate(t)).toHaveLength(0);

    const f = build({ isGuest: 'false' });
    expect(f.isGuest).toBe(false);
    expect(await validate(f)).toHaveLength(0);
  });
});
