import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { ReorderMobileHomeCardsDto } from './mobile-home-cards.dto';
import { conflictOnSerialization, toAdminMobileHomeCards } from './mobile-home-card.helpers';

@Injectable()
export class ReorderMobileHomeCardsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly storage: MinioService,
  ) {}

  async execute(dto: ReorderMobileHomeCardsDto) {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new ConflictException('Duplicate mobile home card ids are not allowed');
    try {
      const cards = await this.rlsTransaction.withTransaction(async (tx) => {
        const current = await tx.mobileHomeCard.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
        if (current.length !== dto.items.length || current.some((card) => !ids.includes(card.id)) || ids.some((id) => !current.some((card) => card.id === id))) {
          throw new ConflictException('Mobile home card list changed. Refresh and try again.');
        }
        const byId = new Map(current.map((card) => [card.id, card]));
        for (const [sortOrder, item] of dto.items.entries()) {
          const card = byId.get(item.id)!;
          if (new Date(item.expectedUpdatedAt).getTime() !== card.updatedAt.getTime()) {
            throw new ConflictException('Mobile home card changed. Refresh and try again.');
          }
          const updatedAt = new Date(Math.max(Date.now(), card.updatedAt.getTime() + 1));
          const result = await tx.mobileHomeCard.updateMany({
            where: { id: item.id, updatedAt: card.updatedAt },
            data: { sortOrder, updatedAt },
          });
          if (result.count !== 1) throw new ConflictException('Mobile home card changed. Refresh and try again.');
          card.updatedAt = updatedAt;
        }
        return tx.mobileHomeCard.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toAdminMobileHomeCards(this.storage, this.prisma, cards);
    } catch (error) {
      return conflictOnSerialization(error);
    }
  }
}
