import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateEmployeeServiceHandler } from './update-employee-service.handler';

describe('UpdateEmployeeServiceHandler', () => {
  const buildPrisma = () => ({
    employeeService: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    employee: { findFirst: jest.fn() },
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
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: true });
    const handler = new UpdateEmployeeServiceHandler(prisma as never);

    const result = await handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1', isActive: false });

    expect(prisma.employeeService.update).toHaveBeenCalledWith({
      where: { employeeId_serviceId: { employeeId: 'emp-1', serviceId: 'svc-1' } },
      data: { isActive: false },
    });
    expect(result).toEqual({ id: 'link-1', isActive: false });
  });

  // ─── Track B — practitioner integrity ──────────────────────────────────────
  // Toggling a link for an inactive employee is silently accepted today.
  // The link state has no effect on availability (the employee is filtered
  // out upstream), but a future re-activation of the employee would
  // resurrect the link silently. Reject the write to keep state consistent.

  it('rejects activating a link (isActive=true) when the employee is inactive', async () => {
    // Track B — practitioner integrity: enabling a link on an inactive
    // employee is the dangerous case — a future re-activation of the
    // employee would silently resurrect a service the admin already
    // intended to keep disabled for that practitioner. Reject the write.
    const prisma = buildPrisma();
    prisma.employeeService.findUnique.mockResolvedValue({ id: 'link-1', isActive: false });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', isActive: false });
    const handler = new UpdateEmployeeServiceHandler(prisma as never);

    await expect(
      handler.execute({ employeeId: 'emp-1', serviceId: 'svc-1', isActive: true }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.employeeService.update).not.toHaveBeenCalled();
  });
});
