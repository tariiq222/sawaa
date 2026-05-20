jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '../../api';
import { publicEmployeesService } from '../employees';

const mockedApi = api as unknown as { get: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('publicEmployeesService.getSlots', () => {
  it('sends explicit deliveryType and category bookingType for availability', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    await publicEmployeesService.getSlots({
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-05-20',
      serviceId: 'service-1',
      deliveryType: 'online',
      bookingType: 'individual',
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/public/availability', {
      params: {
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: '2026-05-20',
        serviceId: 'service-1',
        deliveryType: 'online',
        bookingType: 'INDIVIDUAL',
      },
    });
  });

  it('does not infer online delivery from bookingType', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    await publicEmployeesService.getSlots({
      employeeId: 'emp-1',
      branchId: 'branch-1',
      date: '2026-05-20',
      bookingType: 'group',
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/public/availability', {
      params: {
        employeeId: 'emp-1',
        branchId: 'branch-1',
        date: '2026-05-20',
        deliveryType: 'in_person',
        bookingType: 'GROUP',
      },
    });
  });
});
