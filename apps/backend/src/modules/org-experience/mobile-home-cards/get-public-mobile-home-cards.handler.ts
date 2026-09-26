import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { toPublicMobileHomeCards } from './mobile-home-card.helpers';

@Injectable()
export class GetPublicMobileHomeCardsHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService) {}

  async execute() {
    const cards = await this.prisma.mobileHomeCard.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return toPublicMobileHomeCards(this.storage, this.prisma, cards);
  }
}
