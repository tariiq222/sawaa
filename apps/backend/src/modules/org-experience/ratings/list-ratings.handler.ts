import { Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListRatingsDto } from './list-ratings.dto';

export type ListRatingsCommand = ListRatingsDto;

@Injectable()
export class ListRatingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: ListRatingsCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(dto.employeeId && { employeeId: dto.employeeId }),
      ...(dto.clientId && { clientId: dto.clientId }),
    };

    const [items, total] = await this.rlsTransaction.withTransaction((tx) =>
      Promise.all([
        tx.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        tx.rating.count({ where }),
      ]),
    );

    // Cross-BC clientId carries no Prisma FK relation by design — enrich the
    // reviewer name via a batched lookup so the dashboard isn't stuck on "anonymous".
    const clients = items.length
      ? await this.prisma.client.findMany({
          where: { id: { in: [...new Set(items.map((r) => r.clientId))] } },
          select: { id: true, name: true },
        })
      : [];
    const clientById = new Map(clients.map((c) => [c.id, c]));

    const enriched = items.map((rating) => ({
      ...rating,
      client: clientById.get(rating.clientId) ?? null,
    }));

    return toListResponse(enriched, total, page, limit);
  }
}
