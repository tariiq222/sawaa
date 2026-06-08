-- Manual payment-recording methods (mada / tabby) + per-method settings toggles.
--
-- 1. Extend PaymentMethod with MADA and TABBY. These are recorded MANUALLY by
--    staff (the client paid on the in-clinic POS / via Tabby out-of-band); there
--    is no live gateway integration for them. ADD VALUE runs outside a tx block;
--    Prisma applies each statement separately so this is safe on its own.
-- 2. Add four boolean toggles on OrganizationSettings controlling which methods
--    appear in the bookings "record payment" dialog. Cash + bank default on.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MADA';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TABBY';

ALTER TABLE "OrganizationSettings" ADD COLUMN "payMethodCashEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OrganizationSettings" ADD COLUMN "payMethodBankEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OrganizationSettings" ADD COLUMN "payMethodMadaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationSettings" ADD COLUMN "payMethodTabbyEnabled" BOOLEAN NOT NULL DEFAULT false;
