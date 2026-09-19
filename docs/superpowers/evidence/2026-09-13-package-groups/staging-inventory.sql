-- Read-only staging inventory for the package redesign audit.
-- Aggregate counts only: no names, phones, notes, or other PII. Do not run
-- against production. The coordinator can paste this into a protected staging
-- read-only session and retain the one JSON result.
WITH
item_flags AS (
  SELECT
    i."id",
    i."packageId",
    i."paidQuantity",
    i."freeQuantity",
    i."serviceId",
    i."employeeId",
    i."durationOptionId",
    i."unitPrice",
    i."discountType",
    i."discountValue",
    COUNT(c."id") FILTER (WHERE c."dimension" = 'PRACTITIONER') AS practitioner_constraint_rows,
    COUNT(c."id") AS constraint_rows,
    COUNT(c."id") FILTER (WHERE c."dimension" = 'DELIVERY_TYPE') AS delivery_constraint_rows,
    COUNT(c."id") FILTER (WHERE c."mode" = 'ANY') AS any_constraint_rows,
    COUNT(c."id") FILTER (WHERE c."mode" = 'EXCLUDE') AS exclude_constraint_rows
  FROM "SessionPackageItem" i
  LEFT JOIN "SessionPackageItemConstraint" c ON c."itemId" = i."id"
  GROUP BY i."id"
),
package_practitioners AS (
  SELECT package_id, COUNT(DISTINCT practitioner_id) AS practitioner_count
  FROM (
    SELECT i."packageId" AS package_id, i."employeeId" AS practitioner_id
    FROM "SessionPackageItem" i
    WHERE i."employeeId" IS NOT NULL
    UNION
    SELECT i."packageId", t."targetId"
    FROM "SessionPackageItem" i
    JOIN "SessionPackageItemConstraint" c ON c."itemId" = i."id"
    JOIN "SessionPackageItemConstraintTarget" t ON t."constraintId" = c."id"
    WHERE c."dimension" = 'PRACTITIONER'
      AND c."mode" = 'INCLUDE'
  ) practitioners
  GROUP BY package_id
),
template_counts AS (
  SELECT
    COUNT(*) AS item_count,
    COUNT(*) FILTER (WHERE "serviceId" IS NOT NULL OR "employeeId" IS NOT NULL OR "durationOptionId" IS NOT NULL) AS legacy_scalar_item_count,
    COUNT(*) FILTER (WHERE "serviceId" IS NOT NULL AND "employeeId" IS NOT NULL AND "durationOptionId" IS NOT NULL) AS complete_legacy_triple_item_count,
    COUNT(*) FILTER (WHERE "serviceId" IS NULL AND "employeeId" IS NULL AND "durationOptionId" IS NULL AND constraint_rows > 0) AS flexible_scoped_item_count,
    COUNT(*) FILTER (WHERE "serviceId" IS NULL AND "employeeId" IS NULL AND "durationOptionId" IS NULL AND constraint_rows = 0) AS unscoped_flexible_item_count,
    COUNT(*) FILTER (WHERE "paidQuantity" > 0 AND "freeQuantity" > 0) AS paid_and_free_item_count,
    COUNT(*) FILTER (WHERE "paidQuantity" > 0 AND "freeQuantity" = 0) AS paid_only_item_count,
    COUNT(*) FILTER (WHERE "paidQuantity" = 0 AND "freeQuantity" > 0) AS free_only_item_count,
    COALESCE(SUM("paidQuantity"), 0) AS paid_session_count,
    COALESCE(SUM("freeQuantity"), 0) AS free_session_count,
    COUNT(*) FILTER (WHERE "discountType" IS NOT NULL OR "discountValue" > 0) AS item_discount_item_count,
    COUNT(*) FILTER (WHERE "unitPrice" IS NOT NULL) AS fixed_unit_price_item_count,
    COUNT(*) FILTER (WHERE delivery_constraint_rows > 0) AS delivery_scoped_item_count,
    COUNT(*) FILTER (WHERE any_constraint_rows > 0) AS any_scoped_item_count,
    COUNT(*) FILTER (WHERE exclude_constraint_rows > 0) AS exclude_scoped_item_count
  FROM item_flags
),
template_package_counts AS (
  SELECT
    COUNT(*) AS package_count,
    COUNT(*) FILTER (WHERE p."discountValue" > 0) AS global_discount_nonzero_package_count,
    COUNT(*) FILTER (WHERE p."ownerEmployeeId" IS NOT NULL) AS owner_package_count,
    COUNT(*) FILTER (WHERE COALESCE(pp.practitioner_count, 0) > 1) AS mixed_practitioner_package_count,
    COUNT(*) FILTER (WHERE COALESCE(pp.practitioner_count, 0) = 0) AS no_practitioner_package_count
  FROM "SessionPackage" p
  LEFT JOIN package_practitioners pp ON pp.package_id = p."id"
),
purchase_counts AS (
  SELECT
    COUNT(*) AS purchase_count,
    COUNT(*) FILTER (WHERE p."status" = 'PENDING') AS pending_count,
    COUNT(*) FILTER (WHERE p."status" = 'ACTIVE') AS active_count,
    COUNT(*) FILTER (WHERE p."status" = 'COMPLETED') AS completed_count,
    COUNT(*) FILTER (WHERE p."status" = 'REFUNDED') AS refunded_count,
    COUNT(*) FILTER (WHERE p."creditSnapshot" IS NULL) AS null_credit_snapshot_count,
    COUNT(*) FILTER (WHERE p."status" = 'PENDING' AND p."creditSnapshot" IS NULL) AS pending_null_credit_snapshot_count,
    COUNT(*) FILTER (WHERE p."creditSnapshot" IS NOT NULL AND CASE WHEN jsonb_typeof(p."creditSnapshot") = 'array' THEN jsonb_array_length(p."creditSnapshot") = 0 ELSE TRUE END) AS empty_or_non_array_credit_snapshot_count,
    COUNT(*) FILTER (WHERE p."refundAmount" > p."amountPaid") AS refund_over_amount_paid_count,
    COUNT(*) FILTER (WHERE p."amountPaid" <> (p."subtotalSnapshot" - p."discountSnapshot")) AS purchase_money_snapshot_mismatch_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."packagePurchaseId" = p."id")) AS purchase_without_invoice_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "SessionPackage" sp WHERE sp."id" = p."packageId")) AS purchase_with_missing_template_count
  FROM "PackagePurchase" p
),
snapshot_items AS (
  -- This inspects only array outer shape; application parser validation still
  -- owns enum/number/constraint checks for each item.
  SELECT p."id" AS purchase_id, item
  FROM "PackagePurchase" p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p."creditSnapshot") = 'array'
      THEN p."creditSnapshot" ELSE '[]'::jsonb END
  ) AS expanded(item)
),
snapshot_gap_counts AS (
  SELECT
    COUNT(*) AS snapshot_item_count,
    COUNT(*) FILTER (WHERE jsonb_typeof(item) <> 'object') AS malformed_snapshot_item_count,
    COUNT(*) FILTER (WHERE jsonb_typeof(item) = 'object' AND item->>'netValue' IS NULL) AS snapshot_item_missing_net_value_count,
    COUNT(*) FILTER (WHERE jsonb_typeof(item) = 'object' AND item->>'totalQuantity' IS NULL) AS snapshot_item_missing_quantity_count
  FROM snapshot_items
),
credit_counts AS (
  SELECT
    COUNT(*) AS credit_count,
    COUNT(*) FILTER (WHERE c."netValue" IS NULL) AS null_net_value_count,
    COUNT(*) FILTER (WHERE c."netValue" IS NOT NULL) AS populated_net_value_count,
    COUNT(*) FILTER (WHERE c."totalQuantity" <= 0) AS nonpositive_total_quantity_count,
    COUNT(*) FILTER (WHERE c."usedQuantity" < 0 OR c."reservedQuantity" < 0) AS negative_counter_count,
    COUNT(*) FILTER (WHERE c."usedQuantity" > c."totalQuantity") AS used_over_capacity_count,
    COUNT(*) FILTER (WHERE c."reservedQuantity" > c."totalQuantity") AS reserved_over_capacity_count,
    COUNT(*) FILTER (WHERE c."usedQuantity" + c."reservedQuantity" > c."totalQuantity") AS combined_over_capacity_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "PackageCreditConstraint" pc WHERE pc."creditId" = c."id")) AS missing_constraint_snapshot_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "PackagePurchase" p WHERE p."id" = c."purchaseId")) AS orphan_credit_count
  FROM "PackageCredit" c
),
usage_counts AS (
  SELECT
    COUNT(*) AS usage_count,
    COUNT(*) FILTER (WHERE "status" = 'RESERVED') AS reserved_usage_count,
    COUNT(*) FILTER (WHERE "status" = 'CONSUMED') AS consumed_usage_count,
    COUNT(*) FILTER (WHERE "status" = 'RETURNED') AS returned_usage_count,
    COUNT(*) FILTER (WHERE "bookingId" IS NULL) AS usage_without_booking_count
  FROM "PackageCreditUsage"
),
refund_counts AS (
  SELECT
    COUNT(*) AS refund_event_count,
    COUNT(*) FILTER (WHERE "source" = 'LIVE') AS live_refund_event_count,
    COUNT(*) FILTER (WHERE "source" = 'LEGACY_REQUEST') AS legacy_request_event_count,
    COUNT(*) FILTER (WHERE "source" = 'LEGACY_AGGREGATE') AS legacy_aggregate_event_count,
    COUNT(*) FILTER (WHERE "occurredAt" IS NULL) AS undated_refund_event_count,
    COUNT(*) FILTER (WHERE "sourceRefundRequestId" IS NULL AND "source" = 'LIVE') AS live_event_without_request_count
  FROM "PackageRefundEvent"
)
SELECT jsonb_build_object(
  'templates', jsonb_build_object(
    'packages', (SELECT row_to_json(template_package_counts)::jsonb FROM template_package_counts),
    'items', (SELECT row_to_json(template_counts)::jsonb FROM template_counts)
  ),
  'purchases', (SELECT row_to_json(purchase_counts)::jsonb FROM purchase_counts),
  'snapshot_items', (SELECT row_to_json(snapshot_gap_counts)::jsonb FROM snapshot_gap_counts),
  'credits', (SELECT row_to_json(credit_counts)::jsonb FROM credit_counts),
  'usage', (SELECT row_to_json(usage_counts)::jsonb FROM usage_counts),
  'refund_events', (SELECT row_to_json(refund_counts)::jsonb FROM refund_counts)
) AS package_redesign_inventory;
