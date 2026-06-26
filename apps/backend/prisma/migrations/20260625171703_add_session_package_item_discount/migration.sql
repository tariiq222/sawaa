-- Per-item discount on SessionPackageItem (replaces package-level discount usage).
-- discountType null = no discount. PERCENTAGE → 0-100; FIXED → integer halalas.
ALTER TABLE "SessionPackageItem"
  ADD COLUMN "discountType" "DiscountType",
  ADD COLUMN "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "SessionPackageItem"
  ADD CONSTRAINT "SessionPackageItem_discountValue_nonneg" CHECK ("discountValue" >= 0);
