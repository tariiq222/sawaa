jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from './api';
import { clientsService } from './clients';

const mockedApi = api as unknown as { get: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('clientsService', () => {
  it('gets a client by id from the employee-scoped detail route', async () => {
    const client = { id: 'client-1', firstName: 'Sara', lastName: 'Ali', phone: null, email: 'sara@example.test', avatarUrl: null };
    mockedApi.get.mockResolvedValueOnce({ data: client });

    await expect(clientsService.getById('client-1')).resolves.toEqual(client);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/clients/client-1');
  });

  it('adapts the employee client list without inventing client fields', async () => {
    const list = { data: [{ id: 'client-1', firstName: 'Sara', lastName: 'Ali', phone: null, email: 'sara@example.test', avatarUrl: null }], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } };
    mockedApi.get.mockResolvedValueOnce({ data: list });

    await expect(clientsService.getAll({ limit: 20 })).resolves.toEqual(list);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/clients', { params: { limit: 20 } });
  });

  it('maps backend-shaped history rows into the fields rendered by the record screen', async () => {
    const history = [{
      id: 'booking-1',
      clientId: 'client-1',
      employeeId: 'employee-1',
      bookingType: 'GROUP',
      deliveryType: 'ONLINE',
      status: 'COMPLETED',
      scheduledAt: '2026-09-18T10:00:00.000Z',
      durationMins: 60,
    }];
    mockedApi.get.mockResolvedValueOnce({ data: history });

    await expect(clientsService.getEmployeeBookings('client-1')).resolves.toEqual([{
      id: 'booking-1',
      clientId: 'client-1',
      employeeId: 'employee-1',
      bookingType: 'group',
      deliveryType: 'online',
      type: 'group',
      status: 'completed',
      scheduledAt: '2026-09-18T10:00:00.000Z',
      date: '2026-09-18T10:00:00.000Z',
      durationMins: 60,
    }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/clients/client-1/history');
  });
});
