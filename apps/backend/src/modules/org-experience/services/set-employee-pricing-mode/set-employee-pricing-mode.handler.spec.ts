import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SetEmployeePricingModeHandler } from './set-employee-pricing-mode.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('SetEmployeePricingModeHandler', () => {
  let handler: SetEmployeePricingModeHandler;
  let prisma: {
    employeeService: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    serviceDurationOption: {
      count: jest.Mock;
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
      serviceDurationOption: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeePricingModeHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<SetEmployeePricingModeHandler>(SetEmployeePricingModeHandler);
  });

  it('throws NotFoundException when employee-service link is not found', async () => {
    prisma.employeeService.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute({ employeeId, serviceId, useCustomPricing: false }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.employeeService.findUnique).toHaveBeenCalledWith({
      where: { employeeId_serviceId: { employeeId, serviceId } },
    });
    expect(prisma.employeeService.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when useCustomPricing=true and no owned duration options exist', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.serviceDurationOption.count.mockResolvedValue(0);

    await expect(
      handler.execute({ employeeId, serviceId, useCustomPricing: true }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.serviceDurationOption.count).toHaveBeenCalledWith({
      where: { serviceId, employeeServiceId: linkId, isActive: true },
    });
    expect(prisma.employeeService.update).not.toHaveBeenCalled();
  });

  it('updates and returns { useCustomPricing: true } when owned duration options exist', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.serviceDurationOption.count.mockResolvedValue(2);
    prisma.employeeService.update.mockResolvedValue({ useCustomPricing: true });

    const result = await handler.execute({ employeeId, serviceId, useCustomPricing: true });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { useCustomPricing: true },
      select: { useCustomPricing: true },
    });
    expect(result).toEqual({ useCustomPricing: true });
  });

  it('updates and returns { useCustomPricing: false } without checking owned durations', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
    prisma.employeeService.update.mockResolvedValue({ useCustomPricing: false });

    const result = await handler.execute({ employeeId, serviceId, useCustomPricing: false });

    expect(prisma.serviceDurationOption.count).not.toHaveBeenCalled();
    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { id: linkId },
      data: { useCustomPricing: false },
      select: { useCustomPricing: true },
    });
    expect(result).toEqual({ useCustomPricing: false });
  });
});
