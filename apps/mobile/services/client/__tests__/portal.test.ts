jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '../../api';
import { clientPortalService, type PortalHomeResponse, type PortalSummary } from '../portal';

const mockedApi = api as unknown as { get: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clientPortalService.getHome', () => {
  it('returns the home payload from /mobile/client/portal/home', async () => {
    const payload: PortalHomeResponse = {
      profile: {
        id: 'u1',
        name: 'A B',
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.c',
        phone: null,
        avatarUrl: null,
      },
      upcomingBookings: [],
      unreadNotifications: [],
      recentPayments: [],
    };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const r = await clientPortalService.getHome();

    expect(r).toEqual(payload);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/portal/home');
  });

  it('propagates 401 from the home endpoint', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('401'));
    await expect(clientPortalService.getHome()).rejects.toThrow(/401/);
  });
});

describe('clientPortalService.getSummary', () => {
  it('returns the summary stats', async () => {
    const summary: PortalSummary = { totalBookings: 7, lastVisit: '2026-04-01T00:00:00Z', outstandingBalance: 120 };
    mockedApi.get.mockResolvedValueOnce({ data: summary });
    const r = await clientPortalService.getSummary();
    expect(r).toEqual(summary);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/portal/summary');
  });

  it('propagates 500 errors', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('500'));
    await expect(clientPortalService.getSummary()).rejects.toThrow(/500/);
  });
});

describe('clientPortalService.getUpcoming', () => {
  it('uses the default page=1, limit=10 when no args provided', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
    });
    await clientPortalService.getUpcoming();
    expect(mockedApi.get).toHaveBeenCalledWith(
      '/mobile/client/portal/upcoming',
      { params: { page: 1, limit: 10 } },
    );
  });

  it('forwards explicit pagination args', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { data: [], meta: { total: 0, page: 3, limit: 25, totalPages: 0 } },
    });
    await clientPortalService.getUpcoming(3, 25);
    expect(mockedApi.get).toHaveBeenCalledWith(
      '/mobile/client/portal/upcoming',
      { params: { page: 3, limit: 25 } },
    );
  });

  it('rejects when backend errors out', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('500 boom'));
    await expect(clientPortalService.getUpcoming(1, 10)).rejects.toThrow(/500/);
  });
});
