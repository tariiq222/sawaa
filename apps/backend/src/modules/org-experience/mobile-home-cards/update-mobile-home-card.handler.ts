import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { UpdateMobileHomeCardDto } from './mobile-home-cards.dto';
import { assertArabicAlt, requirePublicImage, toAdminMobileHomeCards } from './mobile-home-card.helpers';

@Injectable()
export class UpdateMobileHomeCardHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly storage: MinioService,
  ) {}

  async execute(command: UpdateMobileHomeCardDto & { id: string }) {
    const current = await this.prisma.mobileHomeCard.findUnique({ where: { id: command.id } });
    if (!current) throw new NotFoundException('Mobile home card not found');
    if (new Date(command.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      throw new ConflictException('Mobile home card changed. Refresh and try again.');
    }
    if (command.sortOrder !== undefined && command.sortOrder < 0) throw new BadRequestException('sortOrder must be nonnegative');

    const imageFileId = command.imageFileId === undefined ? current.imageFileId : command.imageFileId;
    const imageAltAr = command.imageAltAr === undefined ? current.imageAltAr : command.imageAltAr;
    assertArabicAlt(imageFileId, imageAltAr);
    if (imageFileId) await requirePublicImage(this.prisma, imageFileId);

    const { id } = command;
    const fields = {
      titleAr: command.titleAr,
      titleEn: command.titleEn,
      descriptionAr: command.descriptionAr,
      descriptionEn: command.descriptionEn,
      imageFileId: command.imageFileId,
      imageAltAr: command.imageAltAr,
      imageAltEn: command.imageAltEn,
      destination: command.destination,
      sortOrder: command.sortOrder,
      isPublished: command.isPublished,
    };
    const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const write = await tx.mobileHomeCard.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: { ...fields, updatedAt },
      });
      if (write.count !== 1) throw new ConflictException('Mobile home card changed. Refresh and try again.');
      return tx.mobileHomeCard.findUnique({ where: { id } });
    });
    if (!updated) throw new NotFoundException('Mobile home card not found');
    return (await toAdminMobileHomeCards(this.storage, this.prisma, [updated]))[0];
  }
}
