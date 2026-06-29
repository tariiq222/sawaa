import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export type GetServiceCommand = { serviceId: string };

@Injectable()
export class GetServiceHandler {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(dto: GetServiceCommand) {
    const idf = parseEntityRef(dto.serviceId, 'SVC');
    const service = await this.prisma.service.findFirst({
      where: { ...(idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref }), archivedAt: null },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');

    // Sign the stored image keys at read time (audit D.1).
    return {
      ...service,
      imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, service.imageUrl),
      category: service.category
        ? { ...service.category, imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, service.category.imageUrl) }
        : service.category,
    };
  }
}
