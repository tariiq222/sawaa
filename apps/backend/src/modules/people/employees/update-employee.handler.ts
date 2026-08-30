import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { EmployeeDeactivatedEvent } from '../events/employee-deactivated.event';
import { EmployeeReactivatedEvent } from '../events/employee-reactivated.event';
import { UpdateEmployeeDto } from './update-employee.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type UpdateEmployeeCommand = UpdateEmployeeDto & {
  employeeId: string;
};

const EMAIL_IN_USE = {
  message: 'This email is already in use',
  messageAr: 'هذا البريد الإلكتروني مستخدم بالفعل',
  code: 'EMAIL_ALREADY_IN_USE',
} as const;

function throwEmailInUse(): never {
  throw new ConflictException(EMAIL_IN_USE);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

@Injectable()
export class UpdateEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: UpdateEmployeeCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const wasActive = employee.isActive;
    const { employeeId: _e, avatarUrl, email: rawEmail, ...rest } = cmd;
    const data: Record<string, unknown> = { ...rest };
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (cmd.nameAr || cmd.nameEn) {
      data.name = cmd.nameAr ?? cmd.nameEn ?? employee.name;
    }

    const email = typeof rawEmail === 'string' ? normalizeEmail(rawEmail) : undefined;
    if (email !== undefined) {
      data.email = email;
    } else if (rawEmail !== undefined) {
      data.email = rawEmail;
    }

    let updated;
    try {
      updated = await this.rlsTransaction.withTransaction(async (tx) => {
        if (email !== undefined) {
          await this.assertEmailAvailable(tx, email, employee.id, employee.userId);
        }

        const updatedEmployee = await tx.employee.update({
          where: { id: cmd.employeeId },
          data,
          include: { branches: true, services: true },
        });

        if (email !== undefined && employee.userId) {
          await tx.user.update({
            where: { id: employee.userId },
            data: { email },
          });
        }

        return updatedEmployee;
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throwEmailInUse();
      }
      throw err;
    }

    if (cmd.isActive !== undefined && cmd.isActive !== wasActive) {
      const event = cmd.isActive
        ? new EmployeeReactivatedEvent({ employeeId: updated.id, organizationId: DEFAULT_ORG_ID })
        : new EmployeeDeactivatedEvent({ employeeId: updated.id, organizationId: DEFAULT_ORG_ID });
      await this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => undefined);
    }

    return updated;
  }

  private async assertEmailAvailable(
    tx: Prisma.TransactionClient,
    email: string,
    employeeId: string,
    userId: string | null,
  ): Promise<void> {
    const collidingEmployee = await tx.employee.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        id: { not: employeeId },
      },
      select: { id: true },
    });
    if (collidingEmployee) {
      throwEmailInUse();
    }

    const collidingUser = await tx.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(userId ? { id: { not: userId } } : {}),
      },
      select: { id: true },
    });
    if (collidingUser) {
      throwEmailInUse();
    }
  }
}
