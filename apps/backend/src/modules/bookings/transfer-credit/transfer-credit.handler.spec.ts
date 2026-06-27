import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagePurchaseStatus } from '@prisma/client';
import { TransferCreditHandler } from './transfer-credit.handler';

const CREDIT_ID = '00000000-0000-4000-a000-000000000006';
const SERVICE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000005';
const FROM_EMPLOYEE_ID = '00000000-0000-4000-a000-000000000003';
const TO_EMPLOYEE_ID = '00000000-0000-4000-a000-000000000099';

function activeCredit(overrides: Record<string, unknown> = {}) {
  return {
    id: CREDIT_ID,
    serviceId: SERVICE_ID,
    employeeId: FROM_EMPLOYEE_ID,
    durationOptionId: DURATION_OPTION_ID,
    unitPriceSnapshot: 10_000,
    totalQuantity: 5,
    usedQuantity: 1,
    purchase: { id: 'p1', status: PackagePurchaseStatus.ACTIVE, clientId: 'client-1' },
    ...overrides,
  };
}

function buildPrisma(opts: {
  credit?: unknown;
  employeeService?: unknown;
  durationOption?: unknown;
  targetEmployee?: unknown;
} = {}) {
  const tx = {
    packageCredit: { update: jest.fn().mockResolvedValue({ id: CREDIT_ID, employeeId: TO_EMPLOYEE_ID }) },
    activityLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
  };
  return {
    prisma: {
      packageCredit: {
        findFirst: jest.fn().mockResolvedValue(
          opts.credit === undefined ? activeCredit() : opts.credit,
        ),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(
          opts.targetEmployee === undefined
            ? { id: TO_EMPLOYEE_ID, isActive: true }
            : opts.targetEmployee,
        ),
      },
      employeeService: {
        findFirst: jest.fn().mockResolvedValue(
          opts.employeeService === undefined ? { id: 'es-target' } : opts.employeeService,
        ),
      },
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue(
          opts.durationOption === undefined
            ? { id: DURATION_OPTION_ID, serviceId: SERVICE_ID }
            : opts.durationOption,
        ),
      },
    },
    tx,
  };
}

function buildHandler(parts: ReturnType<typeof buildPrisma>) {
  const rls = {
    withTransaction: jest.fn((fn: (t: typeof parts.tx) => Promise<unknown>) => fn(parts.tx)),
  };
  return new TransferCreditHandler(parts.prisma as never, rls as never);
}

const cmd = () => ({ creditId: CREDIT_ID, toEmployeeId: TO_EMPLOYEE_ID, userId: 'user-1' });

describe('TransferCreditHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('transfers the credit to the target employee on the success path', async () => {
    const parts = buildPrisma();
    const handler = buildHandler(parts);

    await handler.execute(cmd());

    expect(parts.tx.packageCredit.update).toHaveBeenCalledWith({
      where: { id: CREDIT_ID },
      data: { employeeId: TO_EMPLOYEE_ID },
    });
  });

  it('P1-3: writes a PackageCredit transfer ActivityLog row with actor + from/to + client', async () => {
    const parts = buildPrisma();
    const handler = buildHandler(parts);

    await handler.execute(cmd());

    expect(parts.tx.activityLog.create).toHaveBeenCalledTimes(1);
    const call = parts.tx.activityLog.create.mock.calls[0][0];
    expect(call.data).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        action: 'UPDATE',
        entity: 'PackageCredit',
        entityId: CREDIT_ID,
        description: expect.stringContaining('credit'),
        metadata: expect.objectContaining({
          creditId: CREDIT_ID,
          fromEmployeeId: FROM_EMPLOYEE_ID,
          toEmployeeId: TO_EMPLOYEE_ID,
          parentPurchaseClientId: 'client-1',
        }),
      }),
    );
  });

  it('does NOT re-price — unitPriceSnapshot is never written', async () => {
    const parts = buildPrisma();
    const handler = buildHandler(parts);

    await handler.execute(cmd());

    const updateData = parts.tx.packageCredit.update.mock.calls[0][0].data;
    expect(updateData).toEqual({ employeeId: TO_EMPLOYEE_ID });
    expect(updateData).not.toHaveProperty('unitPriceSnapshot');
  });

  it('404 when the credit does not exist', async () => {
    const parts = buildPrisma({ credit: null });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('400 when the target employee does not provide the service (no active EmployeeService link)', async () => {
    const parts = buildPrisma({ employeeService: null });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('400 when the duration option is not offered for that service (no matching active option)', async () => {
    const parts = buildPrisma({ durationOption: null });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('400 when the target employee is the same as the current employee (no-op transfer)', async () => {
    const parts = buildPrisma({ credit: activeCredit({ employeeId: TO_EMPLOYEE_ID }) });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('404 when the target employee row does not exist', async () => {
    const parts = buildPrisma({ targetEmployee: null });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('400 when the target employee is inactive', async () => {
    const parts = buildPrisma({ targetEmployee: { id: TO_EMPLOYEE_ID, isActive: false } });
    const handler = buildHandler(parts);

    await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    expect(parts.tx.packageCredit.update).not.toHaveBeenCalled();
  });

  it('validates the EmployeeService link with the credit serviceId + target employee, active only', async () => {
    const parts = buildPrisma();
    const handler = buildHandler(parts);

    await handler.execute(cmd());

    expect(parts.prisma.employeeService.findFirst).toHaveBeenCalledWith({
      where: { employeeId: TO_EMPLOYEE_ID, serviceId: SERVICE_ID, isActive: true },
      select: { id: true },
    });
  });
});
