import { NotFoundException } from '@nestjs/common';
import { UpdateEmployeeServiceHandler } from './update-employee-service.handler';

describe('UpdateEmployeeServiceHandler', () => {
  const buildPrisma = () => ({
    employeeService: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  });

  it('throws when the employee service assignment does not exist', async () => {
    const prisma = buildPrisma();
    prisma.employeeService.findUnique.mockResolvedValue(null);
    const handler = new UpdateEmployeeServiceHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1', isActive: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates isActive on the employee service assignment', async () => {
    const prisma = buildPrisma();
    prisma.employeeService.findUnique.mockResolvedValue({ id: 'link-1', isActive: true });
    prisma.employeeService.update.mockResolvedValue({ id: 'link-1', isActive: false });
    const handler = new UpdateEmployeeServiceHandler(prisma as never);

    const result = await handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1', isActive: false });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { employeeId_serviceId: { employeeId: 'emp-1', serviceId: 'svc-1' } },
      data: { isActive: false },
    });
    expect(result).toEqual({ id: 'link-1', isActive: false });
  });
});
