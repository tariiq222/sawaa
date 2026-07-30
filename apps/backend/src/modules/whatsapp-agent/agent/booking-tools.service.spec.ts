import { BookingToolsService } from './booking-tools.service';

describe('BookingToolsService', () => {
  it('returns exact slots from the public availability handler', async () => {
    const availability = {
      execute: jest.fn().mockResolvedValue([
        {
          startTime: new Date('2026-08-02T06:00:00.000Z'),
          endTime: new Date('2026-08-02T07:00:00.000Z'),
        },
      ]),
    };
    const tools = new BookingToolsService({} as never, availability as never);

    const result = await tools.execute(
      'checkAvailability',
      {
        employeeId: 'employee-1',
        date: '2026-08-02',
        serviceId: 'service-1',
        branchId: 'branch-1',
        durationOptionId: 'duration-1',
        deliveryType: 'ONLINE',
      },
      { phone: '+966500000000' },
    );

    expect(availability.execute).toHaveBeenCalledWith({
      employeeId: 'employee-1',
      date: '2026-08-02',
      serviceId: 'service-1',
      branchId: 'branch-1',
      durationOptionId: 'duration-1',
      deliveryType: 'ONLINE',
    });
    expect(result).toEqual({
      available: true,
      date: '2026-08-02',
      slots: [
        {
          startTime: '2026-08-02T06:00:00.000Z',
          endTime: '2026-08-02T07:00:00.000Z',
        },
      ],
    });
  });
});
