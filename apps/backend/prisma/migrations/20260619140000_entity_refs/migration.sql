-- Add sequential readable reference numbers to core entities.
-- Postgres backfills existing rows with sequential values automatically via nextval default.

-- Client
CREATE SEQUENCE IF NOT EXISTS "Client_ref_seq";
ALTER TABLE "Client" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"Client_ref_seq"');
ALTER SEQUENCE "Client_ref_seq" OWNED BY "Client"."ref";
CREATE UNIQUE INDEX "Client_ref_key" ON "Client"("ref");

-- Employee
CREATE SEQUENCE IF NOT EXISTS "Employee_ref_seq";
ALTER TABLE "Employee" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"Employee_ref_seq"');
ALTER SEQUENCE "Employee_ref_seq" OWNED BY "Employee"."ref";
CREATE UNIQUE INDEX "Employee_ref_key" ON "Employee"("ref");

-- Service
CREATE SEQUENCE IF NOT EXISTS "Service_ref_seq";
ALTER TABLE "Service" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"Service_ref_seq"');
ALTER SEQUENCE "Service_ref_seq" OWNED BY "Service"."ref";
CREATE UNIQUE INDEX "Service_ref_key" ON "Service"("ref");

-- ServiceCategory
CREATE SEQUENCE IF NOT EXISTS "ServiceCategory_ref_seq";
ALTER TABLE "ServiceCategory" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"ServiceCategory_ref_seq"');
ALTER SEQUENCE "ServiceCategory_ref_seq" OWNED BY "ServiceCategory"."ref";
CREATE UNIQUE INDEX "ServiceCategory_ref_key" ON "ServiceCategory"("ref");

-- IntakeForm
CREATE SEQUENCE IF NOT EXISTS "IntakeForm_ref_seq";
ALTER TABLE "IntakeForm" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"IntakeForm_ref_seq"');
ALTER SEQUENCE "IntakeForm_ref_seq" OWNED BY "IntakeForm"."ref";
CREATE UNIQUE INDEX "IntakeForm_ref_key" ON "IntakeForm"("ref");

-- Coupon
CREATE SEQUENCE IF NOT EXISTS "Coupon_ref_seq";
ALTER TABLE "Coupon" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"Coupon_ref_seq"');
ALTER SEQUENCE "Coupon_ref_seq" OWNED BY "Coupon"."ref";
CREATE UNIQUE INDEX "Coupon_ref_key" ON "Coupon"("ref");

-- User
CREATE SEQUENCE IF NOT EXISTS "User_ref_seq";
ALTER TABLE "User" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"User_ref_seq"');
ALTER SEQUENCE "User_ref_seq" OWNED BY "User"."ref";
CREATE UNIQUE INDEX "User_ref_key" ON "User"("ref");
