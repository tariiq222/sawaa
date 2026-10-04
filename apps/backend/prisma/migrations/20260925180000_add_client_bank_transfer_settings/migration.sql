ALTER TABLE "OrganizationSettings"
ADD COLUMN "paymentBankTransferEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bankTransferAccounts" JSONB NOT NULL DEFAULT '[]'::jsonb;
