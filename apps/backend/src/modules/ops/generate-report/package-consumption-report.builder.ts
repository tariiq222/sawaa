import { PrismaService } from '../../../infrastructure/database';
import { PackageCreditUsageStatus } from '@prisma/client';

export interface PackageConsumptionReportParams {
  from: Date;
  to: Date;
}

export interface PackageConsumptionReportResult {
  /** Total CONSUMED package sessions delivered in the range. */
  totalConsumed: number;
  byEmployee: Array<{ employeeId: string; name: string; count: number }>;
}

/**
 * Consumption-per-employee report: count of CONSUMED PackageCreditUsage rows
 * (package sessions actually delivered) grouped by the practitioner the credit
 * is bound to, within the date range (by `usedAt`).
 *
 * The employee is carried on the parent PackageCredit (a credit is locked to a
 * specific practitioner), so we join usage → credit.employeeId. RETURNED usages
 * (cancelled / no-show give the credit back) are excluded — only delivered
 * sessions count.
 */
export async function buildPackageConsumptionReport(
  prisma: PrismaService,
  params: PackageConsumptionReportParams,
): Promise<PackageConsumptionReportResult> {
  const { from, to } = params;

  const usages = await prisma.packageCreditUsage.findMany({
    where: {
      status: PackageCreditUsageStatus.CONSUMED,
      usedAt: { gte: from, lte: to },
    },
    select: { credit: { select: { employeeId: true } } },
  });

  const countByEmployee = new Map<string, number>();
  for (const u of usages) {
    const employeeId = u.credit?.employeeId;
    if (!employeeId) continue;
    countByEmployee.set(employeeId, (countByEmployee.get(employeeId) ?? 0) + 1);
  }

  const employeeIds = [...countByEmployee.keys()];
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true, nameAr: true, nameEn: true },
      })
    : [];
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const byEmployee = [...countByEmployee.entries()]
    .map(([employeeId, count]) => {
      const e = employeeById.get(employeeId);
      return {
        employeeId,
        name: e?.nameAr ?? e?.name ?? '',
        count,
      };
    })
    // Descending by count; stable tiebreak on employeeId for determinism.
    .sort((a, b) => b.count - a.count || a.employeeId.localeCompare(b.employeeId));

  const totalConsumed = usages.length;

  return { totalConsumed, byEmployee };
}
