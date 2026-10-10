import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import { parseEntityRef } from '../../../common/parse-entity-ref';

@Injectable()
export class GetCategoryHandler {
  constructor(private readonly prisma: PrismaService, private readonly storage: MinioService, private readonly config: ConfigService) {}
  async execute({ categoryId }: { categoryId: string }) {
    const identifier = parseEntityRef(categoryId, 'CAT');
    const item = await this.prisma.serviceCategory.findFirst({ where: identifier.kind === 'uuid' ? {id: identifier.id} : {ref: identifier.ref}, include: {department: {select:{id:true,nameAr:true,nameEn:true}}} });
    if (!item) throw new NotFoundException('Category not found');
    return {...item, imageUrl: await signMediaImageUrl(this.storage, this.config.getOrThrow<string>('MINIO_BUCKET'), item.imageUrl)};
  }
}
