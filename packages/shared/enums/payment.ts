// Wire contract source of truth: Prisma `PaymentMethod` enum
// (apps/backend/prisma/schema/finance.prisma) — mirrored verbatim in
// apps/backend/openapi.json `components.schemas.PaymentMethod`.
// Values are the exact UPPERCASE strings the API emits and accepts.
export enum PaymentMethod {
  ONLINE_CARD = 'ONLINE_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  COUPON = 'COUPON',
  MADA = 'MADA',
  TABBY = 'TABBY',
}

// Wire contract source of truth: Prisma `PaymentStatus` enum
// (apps/backend/prisma/schema/finance.prisma) — mirrored verbatim in
// apps/backend/openapi.json `components.schemas.PaymentStatus`.
export enum PaymentStatus {
  PENDING = 'PENDING',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
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

// String-literal union companions. TypeScript string enums are nominal —
// a bare literal like 'COMPLETED' is NOT assignable to the enum type — so
// consumers that compare/assign raw wire strings (e.g. the dashboard's
// `status === 'COMPLETED'`) use these unions, while the enum above remains
// the single source of the value set. `${Enum}` keeps them in lockstep.
export type PaymentMethodValue = `${PaymentMethod}`;
export type PaymentStatusValue = `${PaymentStatus}`;
export type TransferVerificationStatusValue = `${TransferVerificationStatus}`;
