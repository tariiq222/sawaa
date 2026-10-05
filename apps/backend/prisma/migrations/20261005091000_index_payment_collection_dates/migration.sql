-- Run outside a transaction: concurrent builds avoid blocking hot payment writes.
-- Exact expressions used by the CREATED / PROCESSED reporting paths.
CREATE INDEX CONCURRENTLY "Payment_collection_created_idx" ON "Payment" (COALESCE("effectiveReceivedAt", "createdAt") DESC, "id" DESC);
CREATE INDEX CONCURRENTLY "Payment_collection_processed_idx" ON "Payment" (COALESCE("effectiveReceivedAt", "processedAt"));
