jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

import api from './api';
import {
  employeesService,
  projectAvailabilityForUpdate,
  toggleAvailabilityDay,
  type AvailabilityDayGroup,
} from './employees';

const mockedApi = api as unknown as { get: jest.Mock; patch: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('employeesService.updateAvailabilitySchedule', () => {
  it('uses the authenticated schedule PATCH with windows and exceptions', async () => {
    const payload = {
      windows: [{ id: 'window-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
      exceptions: [{ id: 'exception-1', startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: null }],
    };
    const response = { windows: payload.windows, exceptions: payload.exceptions };
    mockedApi.patch.mockResolvedValueOnce({ data: response });

    await expect(employeesService.updateAvailabilitySchedule(payload)).resolves.toEqual(response);
    expect(mockedApi.patch).toHaveBeenCalledWith('/mobile/employee/schedule/availability', {
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }],
      exceptions: [{ startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: null }],
    });
  });
});

describe('availability schedule helpers', () => {
  it('creates an explicit default window when enabling an unscheduled day', () => {
    const schedule: AvailabilityDayGroup[] = [
      { dayOfWeek: 0, windows: [] },
      { dayOfWeek: 1, windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true }] },
    ];

    expect(toggleAvailabilityDay(schedule, 0)).toEqual([
      { dayOfWeek: 0, windows: [{ dayOfWeek: 0, startTime: '08:00', endTime: '17:00', isActive: true }] },
      schedule[1],
    ]);
  });

  it('projects loaded ids out of the PATCH payload while preserving times and null reasons', () => {
    expect(projectAvailabilityForUpdate({
      windows: [{ id: 'window-1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: false }],
      exceptions: [{ id: 'exception-1', startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: null }],
    })).toEqual({
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: false }],
      exceptions: [{ startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: null }],
    });
  });
});

describe('employeesService.getAvailabilitySchedule', () => {
  it('reads the authenticated employee windows and exceptions', async () => {
    const response = {
      employeeId: 'employee-1',
      windows: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
      ],
      exceptions: [{ startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: 'Leave' }],
    };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    await expect(employeesService.getAvailabilitySchedule()).resolves.toEqual(response);
    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/employee/schedule/availability');
  });
});
