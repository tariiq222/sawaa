import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * Minimal Prisma-like surface the deposit helper needs. Accepting this narrow
 * shape (rather than the full PrismaService) lets the same logic run against a
 * `tx` transaction client, the CLS-scoped prisma proxy, or a test double.
 *
 * `depositAmount` is a Decimal(12,2) column of whole halalas; the real client
 * yields Prisma.Decimal while test doubles may supply a plain number/string.
 *
 * The `program` accessor is OPTIONAL. Callers that don't expose a Program
 * delegate (e.g. callers operating on legacy schemas, or test doubles that
 * only need the service path) simply omit it — the program branch is skipped
 * and the helper degrades to the service/no-deposit path. Once the Program
 * table exists in the generated Prisma client, callers can pass the full
 * client and the program branch activates.
 */
export interface DepositPrismaClient {
  booking: {
    findFirst(args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }): Promise<{ serviceId: string | null; programId?: string | null } | null>;
  };
  service: {
    findFirst(args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }): Promise<{
      depositEnabled: boolean;
      depositAmount: Prisma.Decimal | number | string | null;
    } | null>;
  };
  program?: {
    findFirst(args: {
      where: { id: string };
      select?: Record<string, unknown>;
    }): Promise<{
      depositEnabled: boolean;
      depositAmount: Prisma.Decimal | number | string | null;
    } | null>;
  };
}

export interface DepositConfig {
  /** true when the booking's service or program has deposit collection enabled with a positive amount */
  enabled: boolean;
  /** the exact deposit amount in integer halalas, or null when not enabled */
  depositAmount: number | null;
}

interface RawDepositRow {
  depositEnabled: boolean;
  depositAmount: Prisma.Decimal | number | string | null;
}

function resolveDepositFromRow(row: RawDepositRow | null): DepositConfig {
  if (!row || row.depositEnabled !== true) {
    return { enabled: false, depositAmount: null };
  }

  // depositAmount is a Decimal(12,2) of integer halalas — coerce via toString
  // so a Prisma.Decimal, string, or number all normalize correctly. Kept as a
  // tolerant Number() coercion (not decimalToHalalas) on purpose: a garbage
  // value must degrade to "no deposit", never block a payment by throwing.
  const amount =
    row.depositAmount == null
      ? NaN
      : Math.round(Number(row.depositAmount.toString()));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { enabled: false, depositAmount: null };
  }

  return { enabled: true, depositAmount: amount };
}

/**
 * Resolve the deposit configuration for an invoice from its underlying service
 * or program.
 *
 * There is NO Prisma relation `invoice.booking` — invoices link to bookings only
 * via the scalar `bookingId`. We therefore load the booking (for its serviceId
 * or programId) and then the service/program independently.
 *
 * Resolution order:
 *   1. If the booking has a `serviceId` → consult the Service row.
 *   2. Else if the booking has a `programId` AND the client exposes a
 *      `program` accessor → consult the Program row.
 *   3. Otherwise → no deposit.
 *
 * Returns `{ enabled: false, depositAmount: null }` for:
 *   - bundle-purchase invoices (no bookingId),
 *   - bookings whose service/program has no deposit configured,
 *   - a depositEnabled row with a missing / non-positive depositAmount
 *     (treated as "no deposit" — never block a payment on a misconfigured row),
 *   - GROUP/program bookings when the client does not expose a Program
 *     delegate (legacy callers during the schema transition).
 */
export async function resolveInvoiceDeposit(
  client: DepositPrismaClient,
  bookingId: string | null,
): Promise<DepositConfig> {
  if (!bookingId) return { enabled: false, depositAmount: null };

  const booking = await client.booking.findFirst({
    where: { id: bookingId },
    select: { serviceId: true, programId: true },
  });
  if (!booking) return { enabled: false, depositAmount: null };

  if (booking.serviceId) {
    const service = await client.service.findFirst({
      where: { id: booking.serviceId },
      select: { depositEnabled: true, depositAmount: true },
    });
    return resolveDepositFromRow(service);
  }

  if (booking.programId && client.program) {
    const program = await client.program.findFirst({
      where: { id: booking.programId },
      select: { depositEnabled: true, depositAmount: true },
    });
    return resolveDepositFromRow(program);
  }

  return { enabled: false, depositAmount: null };
}

/**
 * Enforce the deposit-amount rule for the FIRST accepted payment on a
 * deposit-enabled invoice.
 *
 * Business rule (owner-decided): a client may pay EITHER the exact deposit OR
 * the full outstanding total — nothing in between, and never less than the
 * deposit. `outstanding` is the remaining balance (total − Σ COMPLETED); for the
 * first payment it equals the full total. Once a deposit has already been
 * collected (alreadyPaid > 0) this rule no longer applies — the client is
 * settling the remainder, which the standard outstanding-balance clamp covers.
 *
 * @param amount       the proposed payment amount (integer halalas)
 * @param depositAmount the exact configured deposit (integer halalas)
 * @param outstanding  remaining balance before this payment (integer halalas)
 * @param alreadyPaid  Σ of COMPLETED payments before this one (integer halalas)
 *
 * @throws BadRequestException when the amount is neither the deposit nor the
 *         full outstanding total.
 */
export function assertDepositPaymentAmount(args: {
  amount: number;
  depositAmount: number;
  outstanding: number;
  alreadyPaid: number;
}): void {
  const { amount, depositAmount, outstanding, alreadyPaid } = args;

  // Rule only governs the FIRST payment. After any money has landed, the
  // deposit has been satisfied (or skipped via a full payment) and the normal
  // outstanding clamp takes over.
  if (alreadyPaid > 0) return;

  if (amount === depositAmount || amount === outstanding) return;

  throw new BadRequestException(
    `Payment must equal the deposit amount (${depositAmount}) or the full total (${outstanding})`,
  );
}

/**
 * Decide whether a just-applied first payment was a DEPOSIT (exact deposit, with
 * a balance still due) rather than a full settlement.
 *
 * @param paidAfter  Σ COMPLETED payments AFTER this payment (integer halalas)
 * @param total      invoice total (integer halalas)
 * @param depositAmount the exact configured deposit (integer halalas)
 */
export function isDepositPayment(args: {
  paidAfter: number;
  total: number;
  depositAmount: number | null;
}): boolean {
  const { paidAfter, total, depositAmount } = args;
  if (depositAmount == null) return false;
  // A deposit leaves the invoice PARTIALLY_PAID: exactly the deposit collected,
  // strictly less than the total.
  return paidAfter === depositAmount && paidAfter < total;
}
