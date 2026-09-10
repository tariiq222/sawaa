import type { PrismaClient } from '@prisma/client';

export async function hasIntakeHistorySchema(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ historyInstalled: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'IntakeResponse'
        AND column_name = 'supersededAt'
    ) AS "historyInstalled"
  `;
  if (rows.length !== 1 || typeof rows[0].historyInstalled !== 'boolean') {
    throw new Error('Unable to establish legacy import schema compatibility');
  }
  return rows[0].historyInstalled;
}
