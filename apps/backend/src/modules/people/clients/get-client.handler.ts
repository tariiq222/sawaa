import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';
import { serializeClient } from './client.serializer';

export interface GetClientQuery {
  clientId: string;
}

@Injectable()
export class GetClientHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetClientQuery) {
    const idf = parseEntityRef(query.clientId, 'CL');
    const client = await this.prisma.client.findFirst({
      where: { ...(idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref }), deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
    return serializeClient(client);
  }
}
