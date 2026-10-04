import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { toAdminMobileHomeCards } from './mobile-home-card.helpers';

@Injectable()
export class ListMobileHomeCardsHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService) {}

  async execute() {
    const cards = await this.prisma.mobileHomeCard.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    return toAdminMobileHomeCards(this.storage, this.prisma, cards);
  }
}
