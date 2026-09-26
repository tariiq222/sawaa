import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { CreateMobileHomeCardDto } from './mobile-home-cards.dto';
import { assertArabicAlt, requirePublicImage, toAdminMobileHomeCards } from './mobile-home-card.helpers';

@Injectable()
export class CreateMobileHomeCardHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService) {}

  async execute(dto: CreateMobileHomeCardDto) {
    if (dto.sortOrder !== undefined && dto.sortOrder < 0) throw new BadRequestException('sortOrder must be nonnegative');
    assertArabicAlt(dto.imageFileId, dto.imageAltAr);
    if (dto.imageFileId) await requirePublicImage(this.prisma, dto.imageFileId);
    const card = await this.prisma.mobileHomeCard.create({ data: {
      titleAr: dto.titleAr,
      titleEn: dto.titleEn ?? null,
      descriptionAr: dto.descriptionAr ?? null,
      descriptionEn: dto.descriptionEn ?? null,
      imageFileId: dto.imageFileId ?? null,
      imageAltAr: dto.imageAltAr ?? null,
      imageAltEn: dto.imageAltEn ?? null,
      destination: dto.destination ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isPublished: dto.isPublished ?? false,
    } });
    return (await toAdminMobileHomeCards(this.storage, this.prisma, [card]))[0];
  }
}
