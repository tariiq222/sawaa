import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  DeliveryType,
  PackageConstraintDimension,
  PackageModelVersion,
  PackagePurchaseStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { TransferCreditDto } from './transfer-credit.dto';
import { lockPackagePurchase } from '../package-purchase-lock.helper';

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
        durationMinsSnapshot: true,
        deliveryTypeSnapshot: true,
        purchaseGroupId: true,
        usedQuantity: true,
        reservedQuantity: true,
        purchase: { select: { id: true, status: true, clientId: true, modelVersion: true } },
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
    const isGroupedV2 = credit.purchase?.modelVersion === PackageModelVersion.GROUPED_V2;
    if (isGroupedV2 && (!cmd.userId?.trim() || !cmd.reason?.trim() || cmd.reason.trim().length < 3)) {
      throw new BadRequestException('Grouped credit transfers require an authenticated actor and a reason of at least 3 characters');
    }
    if (isGroupedV2 && (credit.usedQuantity > 0 || credit.reservedQuantity > 0)) {
      throw new BadRequestException('A grouped package credit can only be transferred before booking');
    }
    if (!isGroupedV2 && credit.reservedQuantity > 0) {
      throw new BadRequestException('A reserved package credit cannot be transferred');
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

    const service = await this.prisma.service.findFirst({
      where: { id: creditServiceId },
      select: { id: true, isActive: true, archivedAt: true, category: { select: { isActive: true } } },
    });
    if (!service) throw new NotFoundException('Credit service not found');
    if (service.isActive === false || service.archivedAt != null || service.category?.isActive === false) {
      throw new BadRequestException('Credit service is not active');
    }

    // 3. Target must offer the SAME service (active EmployeeService link).
    const employeeService = await this.prisma.employeeService.findFirst({
      where: { employeeId: cmd.toEmployeeId, serviceId: creditServiceId, isActive: true },
      select: { id: true, isActive: true, disabledDeliveryTypes: true, useCustomPricing: true },
    });
    if (!employeeService) {
      throw new BadRequestException('Target employee does not provide this service');
    }

    if (employeeService.isActive === false) {
      throw new BadRequestException('Target employee does not provide this service');
    }

    // 4. Resolve an option offered by the target practitioner. V2 may use a
    // different option ID as long as its frozen duration and delivery match.
    let durationOption: { id: string; serviceId: string; durationMins?: number; deliveryType?: DeliveryType } | null;
    if (isGroupedV2) {
      if (credit.durationMinsSnapshot == null || !credit.deliveryTypeSnapshot) {
        throw new BadRequestException('Grouped package credit snapshot is incomplete');
      }
      const deliveryType = credit.deliveryTypeSnapshot as DeliveryType;
      if ((employeeService.disabledDeliveryTypes ?? []).includes(deliveryType)) {
        throw new BadRequestException('Target employee does not offer the frozen delivery type');
      }
      const activeConfigs = await this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: creditServiceId, isActive: true },
        select: { deliveryType: true },
      });
      if (activeConfigs.length > 0 && !activeConfigs.some((config) => config.deliveryType === deliveryType)) {
        throw new BadRequestException('Credit delivery type is no longer offered by the service');
      }

      const employeeServiceId = employeeService.useCustomPricing ? employeeService.id : null;
      const optionRows = await this.prisma.serviceDurationOption.findMany({
        where: {
          serviceId: creditServiceId,
          employeeServiceId,
          deliveryType,
          isActive: true,
          ...(cmd.targetDurationOptionId ? { id: cmd.targetDurationOptionId } : {}),
        },
        select: { id: true, serviceId: true, durationMins: true, deliveryType: true },
      });
      if (optionRows.length === 0) {
        throw new BadRequestException('No target duration option matches the frozen package offering');
      }

      const overrides = !employeeService.useCustomPricing
        ? await this.prisma.employeeServiceOption.findMany({
            where: {
              employeeServiceId: employeeService.id,
              durationOptionId: { in: optionRows.map((option) => option.id) },
              deliveryType,
              isActive: true,
            },
            select: { durationOptionId: true, durationOverride: true },
          })
        : [];
      const overrideByOption = new Map(overrides.map((override) => [override.durationOptionId, override]));
      const effectiveOptions = optionRows.map((option) => ({
        ...option,
        durationMins: overrideByOption.get(option.id)?.durationOverride ?? option.durationMins,
      }));
      durationOption = effectiveOptions.find(
        (option) => option.durationMins === credit.durationMinsSnapshot,
      ) ?? null;
      if (!durationOption || durationOption.durationMins !== credit.durationMinsSnapshot || durationOption.deliveryType !== credit.deliveryTypeSnapshot) {
        throw new BadRequestException('No target duration option matches the frozen package offering');
      }
    } else {
      durationOption = await this.prisma.serviceDurationOption.findFirst({
        where: { id: creditDurationOptionId, serviceId: creditServiceId, isActive: true },
        select: { id: true, serviceId: true },
      });
    }
    if (!durationOption) {
      throw new BadRequestException(
        'Duration option is not available for the target employee at this service',
      );
    }

    // 5. Re-point the credit + write an audit row in ONE transaction. Price
    //    snapshot stays frozen — only employeeId moves. The audit row makes
    //    the credit-routing change traceable (who moved whose credit, from/to
    //    which practitioner) — without it a credit transfer leaves no trail.
    return this.rlsTransaction.withTransaction(async (tx) => {
      const purchase = credit.purchase?.id
        ? await lockPackagePurchase(tx, credit.purchase.id)
        : null;
      if (!purchase) {
        throw new NotFoundException('Package purchase not found');
      }
      if (purchase.status === PackagePurchaseStatus.REFUNDED) {
        throw new BadRequestException('Package purchase is already refunded');
      }

      const currentCredit = await tx.packageCredit.findUnique({
        where: { id: credit.id },
        select: {
          serviceId: true,
          employeeId: true,
          durationOptionId: true,
          durationMinsSnapshot: true,
          deliveryTypeSnapshot: true,
          usedQuantity: true,
          reservedQuantity: true,
          purchaseGroupId: true,
        },
      });
      if (!currentCredit) {
        throw new NotFoundException('Package credit not found');
      }
      if (
        currentCredit.serviceId !== credit.serviceId ||
        currentCredit.employeeId !== credit.employeeId ||
        currentCredit.durationOptionId !== credit.durationOptionId ||
        currentCredit.durationMinsSnapshot !== (credit.durationMinsSnapshot ?? null) ||
        currentCredit.deliveryTypeSnapshot !== (credit.deliveryTypeSnapshot ?? null)
      ) {
        throw new BadRequestException('Package credit routing or offering changed; please refresh and retry');
      }
      // No-op guard runs after the parent lock and current ownership read so a
      // concurrent transfer cannot make the preflight owner stale.
      if (currentCredit.employeeId === cmd.toEmployeeId) {
        throw new BadRequestException('Credit already belongs to this employee');
      }
      const fromEmployeeId = currentCredit.employeeId;
      if (currentCredit.purchaseGroupId && (currentCredit.usedQuantity > 0 || currentCredit.reservedQuantity > 0)) {
        throw new BadRequestException('A grouped package credit can only be transferred before booking');
      }
      if (!currentCredit.purchaseGroupId && currentCredit.reservedQuantity > 0) {
        throw new BadRequestException('A reserved package credit cannot be transferred');
      }

      const updated = await tx.packageCredit.update({
        where: { id: credit.id },
        data: {
          employeeId: cmd.toEmployeeId,
          ...(isGroupedV2 && durationOption.id !== creditDurationOptionId
            ? { durationOptionId: durationOption.id }
            : {}),
        },
      });

      // Keep the authoritative matching snapshot aligned with the current
      // routing. Price, net value, duration minutes and delivery remain frozen.
      await tx.packageCreditConstraint.deleteMany({
        where: {
          creditId: credit.id,
          dimension: { in: [PackageConstraintDimension.PRACTITIONER, PackageConstraintDimension.DURATION] },
        },
      });
      await tx.packageCreditConstraint.create({
        data: {
          creditId: credit.id,
          dimension: PackageConstraintDimension.PRACTITIONER,
          mode: 'INCLUDE',
          targets: { create: [{ targetId: cmd.toEmployeeId }] },
        },
      });
      await tx.packageCreditConstraint.create({
        data: {
          creditId: credit.id,
          dimension: PackageConstraintDimension.DURATION,
          mode: 'INCLUDE',
          targets: { create: [{ targetId: durationOption.id }] },
        },
      });

      await tx.packageCreditAssignmentEvent.create({
        data: {
          creditId: credit.id,
          fromEmployeeId,
          toEmployeeId: cmd.toEmployeeId,
          actorId: cmd.userId ?? '',
          reason: cmd.reason?.trim() || 'Practitioner transfer',
        },
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
