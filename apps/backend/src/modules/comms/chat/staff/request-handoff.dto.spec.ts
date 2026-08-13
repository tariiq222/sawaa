import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientRequestHandoffDto, GuestRequestHandoffDto } from './request-handoff.dto';

describe('request handoff DTOs', () => {
  it('trims a guest name and normalizes a valid Saudi mobile', async () => {
    const dto = plainToInstance(GuestRequestHandoffDto, { guestName: '  سارة  ', guestPhone: '0501234567' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toEqual(expect.objectContaining({ guestName: 'سارة', guestPhone: '+966501234567' }));
  });

  it.each([
    { guestPhone: '+966501234567' },
    { guestName: 'سارة' },
    { guestName: '   ', guestPhone: '+966501234567' },
  ])('rejects missing or invalid guest contact: %j', async (input) => {
    expect(await validate(plainToInstance(GuestRequestHandoffDto, input))).not.toHaveLength(0);
  });

  it('rejects a non-Saudi mobile during normalization', () => {
    expect(() => plainToInstance(GuestRequestHandoffDto, {
      guestName: 'سارة', guestPhone: '+966401234567',
    })).toThrow('invalid_phone');
  });

  it('defines no authenticated-client identity or medical/risk fields', async () => {
    const errors = await validate(plainToInstance(ClientRequestHandoffDto, {
      guestName: 'attacker', guestPhone: '+966501234567', clientId: 'client-b', reason: 'medical', riskTag: 'high',
    }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'clientId', 'guestName', 'guestPhone', 'reason', 'riskTag',
    ]);
  });
});
