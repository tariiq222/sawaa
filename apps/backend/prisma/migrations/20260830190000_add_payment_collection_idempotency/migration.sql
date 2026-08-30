-- Additive: durable globally unique idempotency for /collect, including
-- payment:null full discounts that never mint a Payment row.
-- Neighboring finance FKs use ON DELETE RESTRICT / ON UPDATE CASCADE.
-- RLS policies were removed in the single-tenant cleanup; none are added.

CREATE TABLE "PaymentCollectionIdempotency" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCollectionIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentCollectionIdempotency_idempotencyKey_key"
    ON "PaymentCollectionIdempotency"("idempotencyKey");

CREATE UNIQUE INDEX "PaymentCollectionIdempotency_paymentId_key"
    ON "PaymentCollectionIdempotency"("paymentId");

CREATE INDEX "PaymentCollectionIdempotency_invoiceId_idx"
    ON "PaymentCollectionIdempotency"("invoiceId");

ALTER TABLE "PaymentCollectionIdempotency"
    ADD CONSTRAINT "PaymentCollectionIdempotency_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentCollectionIdempotency"
    ADD CONSTRAINT "PaymentCollectionIdempotency_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
