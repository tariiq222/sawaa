import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListPublicTestimonialsDto } from './list-public-testimonials.dto';

export interface PublicTestimonial {
  id: string;
  text: string;
  name: string;
  letter: string;
  rating: number;
  date: string;
}

@Injectable()
export class ListPublicTestimonialsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListPublicTestimonialsDto): Promise<PublicTestimonial[]> {
    const limit = dto.limit ?? 6;

    const rows = (
      await this.prisma.rating.findMany({
        where: { isPublic: true, comment: { not: null } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    ).filter((r) => (r.comment ?? '').trim().length > 0);

    const clientIds = rows.map((r) => r.clientId);
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    return rows.map((r) => {
      const client = clientMap.get(r.clientId);
      const rawName = client?.firstName ?? client?.name ?? 'عميل';
      const anonymized = this.anonymizeName(rawName);
      const letter = this.firstLetter(rawName);
      return {
        id: r.id,
        text: r.comment ?? '',
        name: anonymized,
        letter,
        rating: r.score,
        date: r.createdAt.toISOString(),
      };
    });
  }

  private anonymizeName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length <= 2) return trimmed + '****';
    return trimmed.slice(0, 2) + '****';
  }

  private firstLetter(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'ع';
    return trimmed.charAt(0);
  }
}
