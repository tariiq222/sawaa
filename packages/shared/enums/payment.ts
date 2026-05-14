export enum PaymentMethod {
  MOYASAR = 'moyasar',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AWAITING = 'awaiting',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum TransferVerificationStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  AMOUNT_DIFFERS = 'amount_differs',
  SUSPICIOUS = 'suspicious',
  OLD_DATE = 'old_date',
  UNREADABLE = 'unreadable',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
