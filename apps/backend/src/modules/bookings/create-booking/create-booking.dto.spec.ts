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
  plainToInstance(CreateBookingDto, { ...base, ...raw }, { enableImplicitConversion: true });

describe('CreateBookingDto', () => {
  it('should instantiate', () => {
    expect(new CreateBookingDto()).toBeDefined();
  });

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
