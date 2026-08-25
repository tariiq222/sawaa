import { bookingCreationRequestHash } from './creation-request-hash';

const input = {
  branchId: 'branch-1', clientId: 'client-1', employeeId: 'employee-1', serviceId: 'service-1',
  scheduledAt: '2026-08-20T10:00:00.000Z', endsAt: '2026-08-20T11:00:00.000Z',
  durationMins: 60, durationOptionId: null, bookingType: 'INDIVIDUAL', deliveryType: 'IN_PERSON',
  price: 200, currency: 'SAR', source: 'AI_CHAT',
};

describe('bookingCreationRequestHash', () => {
  it('is stable across Date/string representations and changes for derived quote data', () => {
    expect(bookingCreationRequestHash(input))
      .toBe(bookingCreationRequestHash({ ...input, scheduledAt: new Date(input.scheduledAt) }));
    expect(bookingCreationRequestHash(input))
      .not.toBe(bookingCreationRequestHash({ ...input, price: 201 }));
    expect(bookingCreationRequestHash(input))
      .not.toBe(bookingCreationRequestHash({ ...input, durationMins: 45 }));
    expect(bookingCreationRequestHash(input)).toMatch(/^[a-f0-9]{64}$/);
  });
});
