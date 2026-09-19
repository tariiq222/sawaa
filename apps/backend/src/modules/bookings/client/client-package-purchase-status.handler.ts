import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientPackagePurchasesHandler } from '../../finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';

/**
 * Return the same decorated client purchase projection as the balance list.
 * The ownership probe happens first so a purchase belonging to another client
 * is indistinguishable from a missing purchase, and the finance list handler
 * remains the single source of frozen credit display data.
 */
@Injectable()
export class ClientPackagePurchaseStatusHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listPurchases: ListClientPackagePurchasesHandler,
  ) {}

  async execute(purchaseId: string, clientId: string) {
    const owned = await this.prisma.packagePurchase.findFirst({
      where: { id: purchaseId, clientId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Package purchase not found');

    const purchase = (await this.listPurchases.execute({ clientId }))
      .find((row) => row.id === purchaseId);
    if (!purchase) throw new NotFoundException('Package purchase not found');

    // `notes` is an internal staff field and is intentionally absent from the
    // client contract, while all decorated credits and frozen names remain.
    const { notes: _notes, ...safePurchase } = purchase;
    return safePurchase;
  }
}
