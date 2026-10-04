import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MobileCancelBookingDto } from '../../../api/mobile/client/bookings.controller';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ClientCancelBookingDto, plain);
  return validate(dto);
}

describe('ClientCancelBookingDto', () => {
  it('accepts explicit quote consent without an optional reason', async () => {
    const errors = await validateDto({ acceptedRefundTerms: true, quoteToken: 'a'.repeat(64) });
    expect(errors).toHaveLength(0);
  });

  it('accepts a reason string', async () => {
    const errors = await validateDto({ reason: 'Schedule conflict', acceptedRefundTerms: true, quoteToken: 'a'.repeat(64) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ reason: 42 });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a boolean reason', async () => {
    const errors = await validateDto({ reason: true });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});

describe.each([
  ['public', ClientCancelBookingDto, {}],
  ['mobile', MobileCancelBookingDto, { reason: 'CLIENT_REQUESTED' }],
] as const)('%s cancellation consent DTO', (_audience, Dto, requiredFields) => {
  it('accepts explicit consent with a current-format fingerprint', async () => {
    const errors = await validate(plainToInstance(Dto, { ...requiredFields, acceptedRefundTerms: true, quoteToken: 'a'.repeat(64) }));
    expect(errors).toHaveLength(0);
  });
  it.each([
    [{ quoteToken: 'a'.repeat(64) }, 'acceptedRefundTerms'],
    [{ acceptedRefundTerms: false, quoteToken: 'a'.repeat(64) }, 'acceptedRefundTerms'],
    [{ acceptedRefundTerms: null, quoteToken: 'a'.repeat(64) }, 'acceptedRefundTerms'],
    [{ acceptedRefundTerms: true }, 'quoteToken'],
    [{ acceptedRefundTerms: true, quoteToken: '' }, 'quoteToken'],
    [{ acceptedRefundTerms: true, quoteToken: null }, 'quoteToken'],
    [{ acceptedRefundTerms: true, quoteToken: 'invalid' }, 'quoteToken'],
  ] as const)('rejects invalid consent %p', async (consent, invalidField) => {
    const errors = await validate(plainToInstance(Dto, { ...requiredFields, ...consent }));
    expect(errors.some(error => error.property === invalidField)).toBe(true);
  });
});
