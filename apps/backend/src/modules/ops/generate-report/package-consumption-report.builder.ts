import { PrismaService } from '../../../infrastructure/database';
import { PackageCreditUsageStatus } from '@prisma/client';

export interface PackageConsumptionReportParams {
  from: Date;
  to: Date;
}

export type PackageConsumptionAttribution = 'BOOKING' | 'LEGACY_CREDIT' | 'UNKNOWN' | 'MIXED';

export interface PackageConsumptionReportRow {
  employeeId: string;
  name: string;
  count: number;
  /** Present when the row uses a legacy or otherwise mixed attribution source. */
  attribution?: PackageConsumptionAttribution;
}

export interface PackageConsumptionReportResult {
  /** Total CONSUMED package sessions debited in the range. */
  totalConsumed: number;
  byEmployee: PackageConsumptionReportRow[];
}

/**
 * Consumption-per-employee report: count of CONSUMED PackageCreditUsage rows
 * (package sessions debited) grouped by the practitioner recorded on the
 * historical booking, within the date range (by `consumedAt`). Legacy rows
 * without `consumedAt` use `usedAt` as a read-only fallback.
 *
 * Booking is a plain cross-bounded-context ID, so it is loaded in one batch.
 * The credit's employee is only a labelled legacy fallback when the booking
 * is absent or does not carry an employee. RETURNED usages (cancelled / no-show
 * give the credit back) are excluded by the CONSUMED status filter.
 */
export async function buildPackageConsumptionReport(
  prisma: PrismaService,
  params: PackageConsumptionReportParams,
): Promise<PackageConsumptionReportResult> {
  const { from, to } = params;

  const usages = await prisma.packageCreditUsage.findMany({
    where: {
      status: PackageCreditUsageStatus.CONSUMED,
      OR: [
        { consumedAt: { gte: from, lte: to } },
        { consumedAt: null, usedAt: { gte: from, lte: to } },
      ],
    },
    select: {
      bookingId: true,
      consumedAt: true,
      usedAt: true,
      credit: { select: { employeeId: true } },
    },
  });

  const bookingIds = [
    ...new Set(
      usages
        .map((usage) => usage.bookingId)
        .filter((bookingId): bookingId is string => Boolean(bookingId)),
    ),
  ];
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, employeeId: true, employeeNameSnapshot: true },
      })
    : [];
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));

  type Source = Exclude<PackageConsumptionAttribution, 'MIXED'>;
  type CountRow = {
    count: number;
    sources: Set<Source>;
    historicalName?: string;
  };
  const countByEmployee = new Map<string, CountRow>();
  const employeeIds = new Set<string>();

  for (const u of usages) {
    const booking = u.bookingId ? bookingById.get(u.bookingId) : undefined;
    const bookingEmployeeId = booking?.employeeId ?? null;
    const legacyEmployeeId = u.credit?.employeeId ?? null;
    const employeeId = bookingEmployeeId ?? legacyEmployeeId ?? 'unknown';
    let source: Source = 'UNKNOWN';
    if (bookingEmployeeId) source = 'BOOKING';
    else if (legacyEmployeeId) source = 'LEGACY_CREDIT';

    if (employeeId !== 'unknown') employeeIds.add(employeeId);
    const row = countByEmployee.get(employeeId) ?? { count: 0, sources: new Set<Source>() };
    row.count += 1;
    row.sources.add(source);
    if (bookingEmployeeId && booking?.employeeNameSnapshot && !row.historicalName) {
      row.historicalName = booking.employeeNameSnapshot;
    }
    countByEmployee.set(employeeId, row);
  }

  const employeeIdList = [...employeeIds];
  const employees = employeeIdList.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIdList } },
        select: { id: true, name: true, nameAr: true, nameEn: true },
      })
    : [];
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const byEmployee = [...countByEmployee.entries()]
    .map(([employeeId, row]) => {
      const e = employeeById.get(employeeId);
      const sources = [...row.sources];
      let attribution: PackageConsumptionAttribution = 'UNKNOWN';
      if (sources.length === 1) attribution = sources[0];
      else if (sources.length > 1) attribution = 'MIXED';
      const name = employeeId === 'unknown'
        ? 'Unknown practitioner'
        : row.historicalName ?? e?.nameAr ?? e?.name ?? 'Unknown practitioner';
      const result: PackageConsumptionReportRow = {
        employeeId,
        name,
        count: row.count,
      };
      // Keep the established shape for booking-backed rows. Legacy and unknown
      // records need an explicit marker so their source is not mistaken for
      // confirmed historical appointment attribution.
      if (attribution !== 'BOOKING') result.attribution = attribution;
      return result;
    })
    // Descending by count; stable tiebreak on employeeId for determinism.
    .sort((a, b) => b.count - a.count || a.employeeId.localeCompare(b.employeeId));

  const totalConsumed = usages.length;

  return { totalConsumed, byEmployee };
}
