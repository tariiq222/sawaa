import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryType, PackagePurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { BookFromCreditHandler, BookFromCreditCommand } from '../book-from-credit/book-from-credit.handler';
import { ClientPackageBookDto } from './client-package-book.dto';

export type ClientPackageBookCommand = Omit<BookFromCreditCommand, 'clientId' | 'scheduledAt'> & {
  clientId: string;
  scheduledAt: Date;
};

type OwnedCredit = {
  id: string;
  totalQuantity: number;
  usedQuantity: number;
  reservedQuantity: number;
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  durationMinsSnapshot: number | null;
  deliveryTypeSnapshot: DeliveryType | null;
  purchase: {
    clientId: string;
    status: PackagePurchaseStatus;
    modelVersion: string;
  };
};

/**
 * Client-facing package booking boundary. It binds all work to the session
 * client, checks the purchase/credit before delegating, and derives grouped
 * targets from immutable credit snapshots. The existing booking handler keeps
 * the transaction, eligibility, sequence, and overdraw guards.
 */
@Injectable()
export class ClientPackageBookHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookFromCredit: BookFromCreditHandler,
  ) {}

  async execute(command: ClientPackageBookCommand) {
    const credit = await this.prisma.packageCredit.findFirst({
      where: { id: command.creditId, purchase: { clientId: command.clientId } },
      select: {
        id: true,
        totalQuantity: true,
        usedQuantity: true,
        reservedQuantity: true,
        serviceId: true,
        employeeId: true,
        durationOptionId: true,
        durationMinsSnapshot: true,
        deliveryTypeSnapshot: true,
        purchase: {
          select: { clientId: true, status: true, modelVersion: true },
        },
      },
    }) as OwnedCredit | null;

    if (!credit) throw new NotFoundException('Package credit not found');
    if (credit.purchase.status !== PackagePurchaseStatus.ACTIVE) {
      throw new BadRequestException('Package purchase is not active');
    }
    if (credit.usedQuantity + credit.reservedQuantity >= credit.totalQuantity) {
      throw new ConflictException('No remaining credit in this package');
    }

    const delegated: BookFromCreditCommand = {
      creditId: credit.id,
      branchId: command.branchId,
      scheduledAt: command.scheduledAt,
      clientId: command.clientId,
      notes: command.notes,
    };

    if (credit.purchase.modelVersion === 'GROUPED_V2') {
      if (
        !credit.serviceId ||
        !credit.employeeId ||
        !credit.durationOptionId ||
        credit.durationMinsSnapshot == null ||
        credit.deliveryTypeSnapshot == null
      ) {
        throw new BadRequestException('Grouped package credit snapshot is incomplete');
      }
      delegated.serviceId = credit.serviceId;
      delegated.employeeId = credit.employeeId;
      delegated.durationOptionId = credit.durationOptionId;
      delegated.deliveryType = credit.deliveryTypeSnapshot;
    } else {
      const targetFields = [command.serviceId, command.employeeId, command.durationOptionId]
        .filter((value) => value !== undefined && value !== null);
      if (targetFields.length > 0 && targetFields.length < 3) {
        throw new BadRequestException(
          'Provide all of serviceId, employeeId and durationOptionId for a legacy flexible credit',
        );
      }
      delegated.serviceId = command.serviceId;
      delegated.employeeId = command.employeeId;
      delegated.durationOptionId = command.durationOptionId;
      delegated.deliveryType = command.deliveryType;
    }

    return this.bookFromCredit.execute(delegated);
  }
}

export type ClientPackageBookRequest = Omit<ClientPackageBookDto, 'scheduledAt'> & {
  scheduledAt: Date;
};
