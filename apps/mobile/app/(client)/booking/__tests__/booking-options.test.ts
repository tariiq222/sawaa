jest.mock('@/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '@/services/api';
import {
  getPractitionerBookingOptions,
  toMobileDeliveryType,
} from '../booking-options';

const mockedApi = api as unknown as { get: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPractitionerBookingOptions', () => {
  it('calls the same priced-options endpoint the website uses', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { useCustomPricing: false, disabledDeliveryTypes: [], options: [] },
    });

    await getPractitionerBookingOptions('service-1', 'emp-1');

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/public/services/service-1/practitioners/emp-1/booking-options',
    );
  });

  it('returns the practitioner charged price (halalas), not the service base price (P1-22)', async () => {
    // Backend returns the practitioner's custom price (e.g. 45000 halalas)
    // which differs from the service base price the old flow showed.
    mockedApi.get.mockResolvedValueOnce({
      data: {
        useCustomPricing: true,
        disabledDeliveryTypes: [],
        options: [
          {
            deliveryType: 'IN_PERSON',
            durationOptionId: 'dur-1',
            durationMins: 60,
            price: 45000,
            currency: 'SAR',
            label: null,
          },
        ],
      },
    });

    const result = await getPractitionerBookingOptions('service-1', 'emp-1');

    expect(result.options).toHaveLength(1);
    expect(result.options[0].price).toBe(45000);
    expect(result.options[0].durationOptionId).toBe('dur-1');
  });
});

describe('toMobileDeliveryType', () => {
  it('maps the backend upper snake_case enum to the mobile wire value', () => {
    expect(toMobileDeliveryType('ONLINE')).toBe('online');
    expect(toMobileDeliveryType('IN_PERSON')).toBe('in_person');
  });
});
