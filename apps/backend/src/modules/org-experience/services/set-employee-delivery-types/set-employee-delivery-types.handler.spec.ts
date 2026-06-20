import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeliveryType } from '@prisma/client';
import { SetEmployeeDeliveryTypesHandler } from './set-employee-delivery-types.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('SetEmployeeDeliveryTypesHandler', () => {
  let handler: SetEmployeeDeliveryTypesHandler;
  let prisma: {
    employeeService: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const employeeId = 'emp-uuid';
  const serviceId = 'svc-uuid';
  const linkId = 'link-uuid';

  beforeEach(async () => {
    prisma = {
      employeeService: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeDeliveryTypesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<SetEmployeeDeliveryTypesHandler>(SetEmployeeDeliveryTypesHandler);
  });

  it('throws NotFoundException when employee-service link is not found', async () => {
    prisma.employeeService.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute({ employeeId, serviceId, disabledDeliveryTypes: [] }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.employeeService.findUnique).toHaveBeenCalledWith({
      where: { employeeId_serviceId: { employeeId, serviceId } },
    });
    expect(prisma.employeeService.update).not.toHaveBeenCalled();
  });

  it('normalizes and deduplicates delivery types before saving', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.employeeService.update.mockResolvedValue({
      disabledDeliveryTypes: [DeliveryType.ONLINE],
    });

    // Provide duplicates and a mixed-case alias to exercise normalize + dedupe
    const result = await handler.execute({
      employeeId,
      serviceId,
      disabledDeliveryTypes: ['ONLINE', 'online', 'ONLINE'],
    });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { disabledDeliveryTypes: [DeliveryType.ONLINE] },
      select: { disabledDeliveryTypes: true },
    });
    expect(result).toEqual({ disabledDeliveryTypes: [DeliveryType.ONLINE] });
  });

  it('saves an empty array when no delivery types are disabled (practitioner offers all)', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.employeeService.update.mockResolvedValue({ disabledDeliveryTypes: [] });

    const result = await handler.execute({
      employeeId,
      serviceId,
      disabledDeliveryTypes: [],
    });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { disabledDeliveryTypes: [] },
      select: { disabledDeliveryTypes: true },
    });
    expect(result).toEqual({ disabledDeliveryTypes: [] });
  });

  it('handles multiple distinct delivery types', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.employeeService.update.mockResolvedValue({
      disabledDeliveryTypes: [DeliveryType.IN_PERSON, DeliveryType.ONLINE],
    });

    const result = await handler.execute({
      employeeId,
      serviceId,
      disabledDeliveryTypes: ['IN_PERSON', 'ONLINE'],
    });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { disabledDeliveryTypes: [DeliveryType.IN_PERSON, DeliveryType.ONLINE] },
      select: { disabledDeliveryTypes: true },
    });
    expect(result).toEqual({
      disabledDeliveryTypes: [DeliveryType.IN_PERSON, DeliveryType.ONLINE],
    });
  });
});
