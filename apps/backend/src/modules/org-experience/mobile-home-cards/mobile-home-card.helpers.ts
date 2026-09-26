import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MobileHomeCard } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

export const MOBILE_HOME_CARD_IMAGE_EXPIRY_SECONDS = 300;

export async function requirePublicImage(prisma: PrismaService, fileId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, isDeleted: false } });
  if (!file) throw new NotFoundException('Image file not found');
  if (file.visibility !== 'PUBLIC' || !file.mimetype.toLowerCase().startsWith('image/')) {
    throw new ForbiddenException('Mobile home card images must be public image files');
  }
  return file;
}

export async function imageUrls(storage: MinioService, prisma: PrismaService, fileIds: Array<string | null | undefined>) {
  const ids = [...new Set(fileIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Map<string, string | null>();
  const files = await prisma.file.findMany({
    where: { id: { in: ids }, visibility: 'PUBLIC', isDeleted: false, mimetype: { startsWith: 'image/' } },
    select: { id: true, bucket: true, storageKey: true },
  });
  const entries = await Promise.all(files.map(async (file) => {
    try {
      return [file.id, await storage.getSignedUrl(file.bucket, file.storageKey, MOBILE_HOME_CARD_IMAGE_EXPIRY_SECONDS)] as const;
    } catch {
      return [file.id, null] as const;
    }
  }));
  return new Map(entries);
}

export async function toAdminMobileHomeCards(storage: MinioService, prisma: PrismaService, cards: MobileHomeCard[]) {
  const urls = await imageUrls(storage, prisma, cards.map((card) => card.imageFileId));
  return cards.map((card) => ({ ...card, imageUrl: card.imageFileId ? urls.get(card.imageFileId) ?? null : null }));
}

export async function toPublicMobileHomeCards(storage: MinioService, prisma: PrismaService, cards: MobileHomeCard[]) {
  const urls = await imageUrls(storage, prisma, cards.map((card) => card.imageFileId));
  return cards.map((card) => ({
    id: card.id,
    titleAr: card.titleAr,
    titleEn: card.titleEn,
    descriptionAr: card.descriptionAr,
    descriptionEn: card.descriptionEn,
    imageAltAr: card.imageAltAr,
    imageAltEn: card.imageAltEn,
    destination: card.destination,
    imageUrl: card.imageFileId ? urls.get(card.imageFileId) ?? null : null,
  }));
}

export function assertArabicAlt(imageFileId: string | null | undefined, imageAltAr: string | null | undefined) {
  if (imageFileId && !imageAltAr?.trim()) throw new BadRequestException('Arabic image alt text is required when an image is attached');
}

export function conflictOnSerialization(error: unknown): never {
  if ((error as { code?: string })?.code === 'P2034') {
    throw new ConflictException('Mobile home cards changed during reorder. Refresh and try again.');
  }
  throw error;
}
