import { BadRequestException } from "@nestjs/common";
import { PaymentMethod, Prisma } from "@prisma/client";
export const MANUAL_RECEIPT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "MADA",
  "TABBY",
] as const;
export type ManualReceiptMethod = (typeof MANUAL_RECEIPT_METHODS)[number];
/** Settings defaults mirror OrganizationSettings, without touching gateway flows. */
export async function getEnabledManualReceiptMethods(
  tx: Prisma.TransactionClient,
): Promise<ManualReceiptMethod[]> {
  const settings = await tx.organizationSettings.findFirst({
    where: {},
    orderBy: { createdAt: "desc" },
    select: {
      payMethodCashEnabled: true,
      payMethodBankEnabled: true,
      payMethodMadaEnabled: true,
      payMethodTabbyEnabled: true,
    },
  });
  const enabled: Record<ManualReceiptMethod, boolean> = {
    CASH: settings?.payMethodCashEnabled ?? true,
    BANK_TRANSFER: settings?.payMethodBankEnabled ?? true,
    MADA: settings?.payMethodMadaEnabled ?? false,
    TABBY: settings?.payMethodTabbyEnabled ?? false,
  };
  return MANUAL_RECEIPT_METHODS.filter((method) => enabled[method] === true);
}
export async function assertManualReceiptMethod(
  tx: Prisma.TransactionClient,
  method: PaymentMethod,
): Promise<void> {
  const enabled = await getEnabledManualReceiptMethods(tx);
  if (!enabled.some((candidate) => candidate === method))
    throw new BadRequestException(
      "Manual payment method is disabled or unsupported",
    );
}
