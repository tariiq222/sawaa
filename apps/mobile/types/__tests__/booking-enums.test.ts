import {
  resolveDeliveryType,
  resolveDeliveryTypeFromLegacyResponse,
} from '../booking-enums';

describe('booking enum helpers', () => {
  it('resolves delivery type from deliveryType only for new code paths', () => {
    expect(resolveDeliveryType('online')).toBe('online');
    expect(resolveDeliveryType('in_person')).toBe('in_person');
    expect(resolveDeliveryType(undefined)).toBe('in_person');
  });

  it('keeps bookingType fallback isolated to the legacy response helper', () => {
    expect(resolveDeliveryTypeFromLegacyResponse(null, 'online')).toBe('online');
    expect(resolveDeliveryTypeFromLegacyResponse('in_person', 'online')).toBe('in_person');
  });
});
