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

    const [items, total, aggregate] = await this.rlsTransaction.withTransaction((tx) =>
      Promise.all([
        tx.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        tx.rating.count({ where }),
        tx.rating.aggregate({ where, _avg: { score: true } }),
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

    const employees = items.length ? await this.prisma.employee.findMany({
      where: { id: { in: [...new Set(items.map(r => r.employeeId))] } },
      select: { id: true, name: true, nameEn: true },
    }) : [];
    const employeeById = new Map(employees.map(e => [e.id, e]));
    const enriched = items.map((rating) => ({
      ...rating,
      client: clientById.get(rating.clientId) ?? null,
      employee: employeeById.get(rating.employeeId) ?? null,
    }));

    return { ...toListResponse(enriched, total, page, limit), averageRating: aggregate._avg.score ?? null };
  }
}
