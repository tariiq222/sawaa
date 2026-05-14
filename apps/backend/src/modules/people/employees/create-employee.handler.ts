import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

import { EmployeeCreatedEvent } from '../events/employee-created.event';
import { CreateEmployeeDto } from './create-employee.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type CreateEmployeeCommand = CreateEmployeeDto;

@Injectable()
export class CreateEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(dto: CreateEmployeeCommand) {
    if (dto.email) {
      const existing = await this.prisma.employee.findFirst({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already registered for this employee');
    }

    const employee = await this.rlsTx.withTransaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          gender: dto.gender,
          avatarUrl: dto.avatarUrl,
          bio: dto.bio,
          employmentType: dto.employmentType,
          userId: dto.userId,
          branches: dto.branchIds?.length
            ? { create: dto.branchIds.map((branchId) => ({ branchId })) }
            : undefined,
          services: dto.serviceIds?.length
            ? { create: dto.serviceIds.map((serviceId) => ({ serviceId })) }
            : undefined,
        },
        include: { branches: true, services: true },
      });

      return created;
    });

    const event = new EmployeeCreatedEvent({ employeeId: employee.id, organizationId: DEFAULT_ORG_ID });
    this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => {});

    return employee;
  }
}
