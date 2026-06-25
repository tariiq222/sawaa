import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { TransferCreditDto } from './transfer-credit.dto';

export type TransferCreditCommand = TransferCreditDto & {
  creditId: string;
  /** Acting user id (set by the controller). */
  userId?: string;
};

/**
 * Move a PackageCredit bucket to a different practitioner — the "practitioner
 * left" operational tool.
 *
 * The credit is locked to a single practitioner (the client must book with
 * them), so a transfer re-points `PackageCredit.employeeId`. The price snapshot
 * is FROZEN at purchase time and is NEVER recomputed on transfer — moving a
 * credit to a more/less expensive practitioner does not change what the client
 * already paid. Validation mirrors the package item validation
 * (CreateSessionPackageHandler.validateItems):
 *
 *  1. The credit must exist (404).
 *  2. The target practitioner must exist + be active.
 *  3. The target must offer the SAME service via an active EmployeeService link.
 *  4. The credit's durationOptionId must still belong to that service + be
 *     active (the duration the credit is frozen to must be offered).
 *
 * All within one transaction (single id-keyed update — kept transactional so a
 * future multi-write extension stays atomic, and to match the slice convention).
 */
@Injectable()
export class TransferCreditHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: TransferCreditCommand) {
    // 1. Load the credit (with its parent purchase status for context).
    const credit = await this.prisma.packageCredit.findFirst({
      where: { id: cmd.creditId },
      select: {
        id: true,
        serviceId: true,
        employeeId: true,
        durationOptionId: true,
        purchase: { select: { id: true, status: true } },
      },
    });
    if (!credit) {
      throw new NotFoundException('Package credit not found');
    }

    // No-op guard: transferring to the current owner is meaningless and would
    // mask a UI bug. Reject explicitly.
    if (credit.employeeId === cmd.toEmployeeId) {
      throw new BadRequestException('Credit already belongs to this employee');
    }

    // 2. Target practitioner must exist and be active.
    const targetEmployee = await this.prisma.employee.findFirst({
      where: { id: cmd.toEmployeeId },
      select: { id: true, isActive: true },
    });
    if (!targetEmployee) {
      throw new NotFoundException('Target employee not found');
    }
    if (targetEmployee.isActive === false) {
      throw new BadRequestException('Target employee is not active');
    }

    // 3. Target must offer the SAME service (active EmployeeService link).
    const employeeService = await this.prisma.employeeService.findFirst({
      where: { employeeId: cmd.toEmployeeId, serviceId: credit.serviceId, isActive: true },
      select: { id: true },
    });
    if (!employeeService) {
      throw new BadRequestException('Target employee does not provide this service');
    }

    // 4. The frozen duration option must still belong to that service + be active.
    const durationOption = await this.prisma.serviceDurationOption.findFirst({
      where: { id: credit.durationOptionId, serviceId: credit.serviceId, isActive: true },
      select: { id: true, serviceId: true },
    });
    if (!durationOption) {
      throw new BadRequestException(
        'Duration option is not available for the target employee at this service',
      );
    }

    // 5. Re-point the credit. Price snapshot stays frozen — only employeeId moves.
    return this.rlsTransaction.withTransaction((tx) =>
      tx.packageCredit.update({
        where: { id: credit.id },
        data: { employeeId: cmd.toEmployeeId },
      }),
    );
  }
}
