import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database';
import { decimalToHalalas } from './money.helper';

/**
 * Client-visible debt in integer halalas, independent of invoice pagination.
 * Match payment initialization: only DRAFT/ISSUED/PARTIALLY_PAID invoices
 * are payable, and only COMPLETED payments reduce their remaining balance.
 * Refunded/void invoices must not become new collectible debt here. An unpaid
 * draft for a cancelled/expired reservation is no longer collectible; issued
 * charges and invoices with capture history retain their existing balance.
 */
export async function getClientOutstandingBalance(
  prisma: Pick<PrismaService, '$queryRaw'>,
  clientId: string,
): Promise<number> {
  const [result] = await prisma.$queryRaw<Array<{ outstandingBalance: Prisma.Decimal }>>(Prisma.sql`
    SELECT COALESCE(SUM(GREATEST(0, ROUND(i.total) - COALESCE((
      SELECT SUM(ROUND(p.amount))
      FROM "Payment" p
      WHERE p."invoiceId" = i.id AND p.status = 'COMPLETED'
    ), 0))), 0) AS "outstandingBalance"
    FROM "Invoice" i
    WHERE i."clientId" = ${clientId}
      AND i.status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID')
      AND NOT (
        i.status = 'DRAFT'
        AND EXISTS (
          SELECT 1 FROM "Booking" b
          WHERE b.id = i."bookingId" AND b."clientId" = i."clientId"
            AND b.status IN ('CANCELLED', 'EXPIRED')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Payment" captured
          WHERE captured."invoiceId" = i.id
            AND captured.status IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
        )
      )
  `);
  return decimalToHalalas(result.outstandingBalance);
}
