import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { startOfMonthInTz } from '../../../common/helpers/date-tz.helper';

export interface TopPerformersCommand {
  period: 'month';
}

export interface TopPerformer {
  employeeId: string;
  displayName: string;
  avatarUrl: string | null;
  bookingsCount: number;
  revenue: number;
}

@Injectable()
export class GetTopPerformersHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(_cmd: TopPerformersCommand): Promise<TopPerformer[]> {
    const { start, end } = startOfMonthInTz();

    const rows = await this.prisma.$queryRaw<
      Array<{
        employeeId: string;
        displayName: string;
        avatarUrl: string | null;
        bookingsCount: bigint | number;
        revenue: number | string;
      }>
    >(Prisma.sql`
      SELECT
        e.id                                          AS "employeeId",
        COALESCE(m."displayName", u.name, e.name)     AS "displayName",
        COALESCE(m."avatarUrl", u."avatarUrl")        AS "avatarUrl",
        COUNT(DISTINCT b.id)                          AS "bookingsCount",
        COALESCE(SUM(p.amount), 0)::float             AS "revenue"
      FROM "Employee" e
      LEFT JOIN "User"       u ON u.id = e."userId"
      LEFT JOIN "Membership" m ON m."userId" = e."userId"
      LEFT JOIN "Booking" b ON b."employeeId" = e.id
      LEFT JOIN "Invoice" i ON i."bookingId" = b.id
      LEFT JOIN "Payment" p ON p."invoiceId" = i.id
                           AND p.status = 'COMPLETED'
                           AND p."processedAt" >= ${start}
                           AND p."processedAt" <  ${end}
      GROUP BY e.id, m."displayName", m."avatarUrl", u.name, u."avatarUrl"
      ORDER BY "revenue" DESC NULLS LAST, "bookingsCount" DESC
      LIMIT 5
    `);

    return rows.map((r) => ({
      employeeId: r.employeeId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      bookingsCount: Number(r.bookingsCount),
      revenue: Number(r.revenue),
    }));
  }
}
