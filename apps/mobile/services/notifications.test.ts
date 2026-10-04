jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn() } }));

import api from './api';
import { notificationsService } from './notifications';

const get = api.get as jest.Mock;
const base = {
  id: 'notification-1', recipientId: 'client-1', type: 'booking_confirmed',
  isRead: false, createdAt: '2026-09-27T10:00:00Z', metadata: { bookingId: 'booking-1' },
};
const meta = { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

beforeEach(() => jest.clearAllMocks());

describe('notification API content normalization', () => {
  it('renders the backend title and body for both app languages and preserves navigation data', async () => {
    get.mockResolvedValueOnce({ data: { items: [{ ...base, title: 'تم تأكيد الموعد', body: 'موعدك غداً' }], meta } });
    const result = await notificationsService.getAll({ page: 1, perPage: 20 });
    expect(get).toHaveBeenCalledWith('/mobile/client/notifications', { params: { page: 1, limit: 20 } });
    expect(result.meta).toEqual(meta);
    expect(result.items[0]).toMatchObject({
      ...base, userId: 'client-1', titleAr: 'تم تأكيد الموعد', titleEn: 'تم تأكيد الموعد',
      bodyAr: 'موعدك غداً', bodyEn: 'موعدك غداً',
    });
  });

  it('preserves localized content when the payload provides it', async () => {
    get.mockResolvedValueOnce({ data: { items: [{
      ...base, titleAr: 'موعدك', titleEn: 'Your appointment', bodyAr: 'غداً', bodyEn: 'Tomorrow',
    }], meta } });
    const result = await notificationsService.getAll();
    expect(result.items[0]).toMatchObject({ titleAr: 'موعدك', titleEn: 'Your appointment', bodyAr: 'غداً', bodyEn: 'Tomorrow' });
  });

  it('uses available content when one localized field is empty or missing', async () => {
    get.mockResolvedValueOnce({ data: { items: [{
      ...base, titleAr: '   ', titleEn: 'Appointment', bodyAr: 'غداً', bodyEn: null,
    }], meta } });
    const result = await notificationsService.getAll();
    expect(result.items[0]).toMatchObject({ titleAr: 'Appointment', titleEn: 'Appointment', bodyAr: 'غداً', bodyEn: 'غداً' });
  });
});
