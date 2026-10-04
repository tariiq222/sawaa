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
  it('omits an empty duration option returned by practitioner pricing', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ startTime: '2026-09-29T09:00:00.000Z', endTime: '2026-09-29T09:45:00.000Z' }] });

    const slots = await publicEmployeesService.getSlots({
      employeeId: 'emp-1', branchId: 'branch-1', serviceId: 'service-1',
      date: '2026-09-29', durationOptionId: '', durationMins: 45,
    });

    expect(slots).toHaveLength(1);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/availability', {
      params: {
        employeeId: 'emp-1', branchId: 'branch-1', serviceId: 'service-1',
        date: '2026-09-29', durationMins: 45,
        deliveryType: 'IN_PERSON', bookingType: 'INDIVIDUAL',
      },
    });
  });

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
        deliveryType: 'ONLINE',
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
        deliveryType: 'IN_PERSON',
        bookingType: 'GROUP',
      },
    });
  });
});

describe('publicEmployeesService.getAvailableDays', () => {
  it('probes the selected booking context without an empty duration option', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [
      { date: '2026-09-29', hasSlots: true },
      { date: '2026-09-30', hasSlots: false },
    ] });

    const days = await publicEmployeesService.getAvailableDays({
      employeeId: 'emp-1', branchId: 'branch-1', serviceId: 'service-1',
      startDate: '2026-09-29', days: 2, durationOptionId: '', durationMins: 45,
      deliveryType: 'in_person',
    });

    expect(days).toEqual([
      { date: '2026-09-29', hasSlots: true },
      { date: '2026-09-30', hasSlots: false },
    ]);
    expect(mockedApi.get).toHaveBeenCalledWith('/public/employees/emp-1/availability/days', {
      params: {
        branchId: 'branch-1', serviceId: 'service-1',
        startDate: '2026-09-29', days: 2, durationMins: 45,
        deliveryType: 'IN_PERSON', bookingType: 'INDIVIDUAL',
      },
    });
  });
});

describe('publicEmployeesService discovery', () => {
  it('includes direct clinic assignments in list and detail requests', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await publicEmployeesService.list();
    await publicEmployeesService.getByKey('therapist');
    expect(mockedApi.get).toHaveBeenCalledWith('/public/employees', { params: { includeDirectClinics: true } });
    expect(mockedApi.get).toHaveBeenCalledWith('/public/employees/therapist', { params: { includeDirectClinics: true } });
  });
});
