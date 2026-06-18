jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { groupSessionsService } from '../group-sessions';
import api from '../../api';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const session = { id: 'g1', title: 'مجموعة القلق', scheduledAt: '2026-07-01T18:00:00.000Z', maxCapacity: 10, enrolledCount: 4, spotsLeft: 6, isFull: false, price: 10000, currency: 'SAR', durationMins: 60, status: 'SCHEDULED', employeeId: 'e1', serviceId: 's1', descriptionAr: null, descriptionEn: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('groupSessionsService', () => {
  it('list unwraps enveloped responses', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: [session] } });
    await expect(groupSessionsService.list()).resolves.toEqual([session]);
  });

  it('list passes raw array responses through', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [session] });
    await expect(groupSessionsService.list()).resolves.toEqual([session]);
  });

  it('get fetches by id from the correct URL and unwraps', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: session });
    await expect(groupSessionsService.get('g1')).resolves.toEqual(session);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/bookings/group-sessions/g1');
  });

  it('book posts to the book endpoint and unwraps', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { type: 'BOOKED', bookingId: 'b1' } });
    await expect(groupSessionsService.book('g1')).resolves.toEqual({ type: 'BOOKED', bookingId: 'b1' });
    expect(mockedApi.post).toHaveBeenCalledWith('/public/bookings/group-sessions/g1/book');
  });
});
