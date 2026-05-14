/**
 * Intake Forms — Shared Enums & Types
 *
 * Single source of truth for all intake form enums.
 * Imported by both intake-form.ts (UI layer) and intake-form-api.ts (API layer).
 */

export type FormType = "pre_booking" | "pre_session" | "post_session" | "registration"

export type FormScope = "global" | "service" | "employee" | "branch"

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "radio"
  | "checkbox"
  | "select"
  | "date"
  | "rating"
  | "file"

export type ConditionOperator = "equals" | "not_equals" | "contains"
