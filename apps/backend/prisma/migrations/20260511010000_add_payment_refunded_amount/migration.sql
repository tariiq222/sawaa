-- Add refundedAmount column to Payment model for tracking total refunded amount
ALTER TABLE "Payment" ADD COLUMN "refundedAmount" Decimal(12,2) NOT NULL DEFAULT 0;