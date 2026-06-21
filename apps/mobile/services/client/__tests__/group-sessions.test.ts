jest.mock('../../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { programsService } from '../group-sessions';
import api from '../../api';

const mockedApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const program = {
  id: 'prog-1',
  ref: 1,
  title: 'مجموعة القلق',
  nameAr: 'مجموعة القلق',
  nameEn: null,
  descriptionAr: null,
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  departmentId: 'd-1',
  branchId: 'b-1',
  startDate: '2026-07-01T18:00:00.000Z',
  daysCount: 4,
  hoursPerDay: 2,
  minParticipants: 4,
  maxParticipants: 10,
  enrolledCount: 4,
  price: '10000',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 6,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('programsService (mobile, /public/programs)', () => {
  it('list unwraps enveloped responses', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, programs: [program] } });
    const out = await programsService.list();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('prog-1');
    expect(out[0].scheduledAt).toBe('2026-07-01T18:00:00.000Z');
    expect(out[0].maxCapacity).toBe(10);
  });

  it('list passes raw array responses through', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [program] });
    await expect(programsService.list()).resolves.toHaveLength(1);
  });

  it('get fetches by id from the new /public/programs URL and URL-encodes the id', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: program });
    await expect(programsService.get('prog/1')).resolves.toMatchObject({ id: 'prog-1' });
    expect(mockedApi.get).toHaveBeenCalledWith('/public/programs/prog%2F1');
  });

  it('enroll posts to the new /enroll endpoint and unwraps', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { type: 'ENROLLED', bookingId: 'b1' } });
    await expect(programsService.enroll('prog-1')).resolves.toEqual({ type: 'ENROLLED', bookingId: 'b1' });
    expect(mockedApi.post).toHaveBeenCalledWith('/public/programs/prog-1/enroll');
  });
});
