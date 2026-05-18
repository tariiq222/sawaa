/**
 * Script: identify and fix CASH payments stored in SAR instead of halalas
 *
 * Compares payment.amount * 100 against invoice.total to detect mismatch.
 *
 * Run with:
 *   npx ts-node -r dotenv/config prisma/scripts/fix-cash-payment-amounts.ts
 * Add --dry-run to preview without changes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const payments = await prisma.payment.findMany({
    where: { method: 'CASH' },
    include: { invoice: { select: { total: true } } },
  });

  const toFix: typeof payments = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const payment of payments) {
    const invoiceTotal = Number(payment.invoice.total);
    if (invoiceTotal <= 0) continue;

    const amount = Number(payment.amount);
    if (Math.abs(amount * 100 - invoiceTotal) / invoiceTotal < 0.01) {
      toFix.push(payment);
      totalBefore += amount;
      totalAfter += amount * 100;
    }
  }

  console.log(`Found ${toFix.length} CASH payment(s) stored in SAR instead of halalas`);
  if (toFix.length > 0) {
    console.log('Payment IDs:', toFix.map((p) => p.id).join(', '));
    console.log(`Total amount before fix: ${totalBefore} halalas (SAR ${(totalBefore / 100).toFixed(2)})`);
    console.log(`Total amount after fix:  ${totalAfter} halalas (SAR ${(totalAfter / 100).toFixed(2)})`);
  }

  if (dryRun) {
    console.log('Dry run — no changes applied.');
  } else if (toFix.length > 0) {
    let updated = 0;
    for (const payment of toFix) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { amount: Number(payment.amount) * 100 },
      });
      updated++;
    }
    console.log(`Updated ${updated} payment(s).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
