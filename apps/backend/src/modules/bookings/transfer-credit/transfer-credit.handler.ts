import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
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
        purchase: { select: { id: true, status: true, clientId: true } },
      },
    });
    if (!credit) {
      throw new NotFoundException('Package credit not found');
    }

    // Transfer re-points a credit's single practitioner, so it only applies to
    // legacy single-specific credits. A flexible (rule-based) credit has no fixed
    // service/duration to validate against — reject the transfer for it.
    const creditServiceId = credit.serviceId;
    const creditDurationOptionId = credit.durationOptionId;
    if (!creditServiceId || !creditDurationOptionId) {
      throw new BadRequestException('This credit is not transferable');
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
      where: { employeeId: cmd.toEmployeeId, serviceId: creditServiceId, isActive: true },
      select: { id: true },
    });
    if (!employeeService) {
      throw new BadRequestException('Target employee does not provide this service');
    }

    // 4. The frozen duration option must still belong to that service + be active.
    const durationOption = await this.prisma.serviceDurationOption.findFirst({
      where: { id: creditDurationOptionId, serviceId: creditServiceId, isActive: true },
      select: { id: true, serviceId: true },
    });
    if (!durationOption) {
      throw new BadRequestException(
        'Duration option is not available for the target employee at this service',
      );
    }

    // 5. Re-point the credit + write an audit row in ONE transaction. Price
    //    snapshot stays frozen — only employeeId moves. The audit row makes
    //    the credit-routing change traceable (who moved whose credit, from/to
    //    which practitioner) — without it a credit transfer leaves no trail.
    const fromEmployeeId = credit.employeeId;
    return this.rlsTransaction.withTransaction(async (tx) => {
      const updated = await tx.packageCredit.update({
        where: { id: credit.id },
        data: { employeeId: cmd.toEmployeeId },
      });

      await tx.activityLog.create({
        data: {
          userId: cmd.userId,
          action: ActivityAction.UPDATE,
          entity: 'PackageCredit',
          entityId: credit.id,
          description: 'Transferred a session-package credit to another practitioner',
          metadata: {
            creditId: credit.id,
            fromEmployeeId,
            toEmployeeId: cmd.toEmployeeId,
            parentPurchaseId: credit.purchase?.id ?? null,
            parentPurchaseClientId: credit.purchase?.clientId ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }
}
