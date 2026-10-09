/** The same availability state is needed for the group's credits and its predecessor's credits. */
export const packageCreditGroupCreditSelect = {
  id: true,
  sessionPosition: true,
  totalQuantity: true,
  usedQuantity: true,
  reservedQuantity: true,
  usages: { select: { status: true, deliveredAt: true } },
} as const;
