import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

export interface RemoveEmployeeServiceCommand { employeeId: string; serviceId: string; }

@Injectable()
export class RemoveEmployeeServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: RemoveEmployeeServiceCommand): Promise<void> {
    const record = await this.prisma.employeeService.findUnique({
      where: {
        employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId },
      },
    });
    if (!record) {
      throw new NotFoundException('Service assignment not found');
    }
    // EmployeeServiceOption.employeeServiceId is a plain cross-BC string (no FK),
    // so price-override rows must be cleaned up here or they orphan.
    await this.rlsTransaction.withTransaction((tx) =>
      Promise.all([
        tx.employeeServiceOption.deleteMany({
          where: { employeeServiceId: record.id },
        }),
        tx.employeeService.delete({
          where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
        }),
      ]),
    );
  }
}
