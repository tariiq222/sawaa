import type { OpenApiRequestBody } from "@/lib/api/openapi"

type CreateForm = OpenApiRequestBody<"/api/v1/dashboard/organization/intake-forms", "post">

export type FormType = Lowercase<CreateForm["type"]>
export type FormScope = Lowercase<CreateForm["scope"]>
export type FieldType = Lowercase<NonNullable<CreateForm["fields"]>[number]["fieldType"]>

export type ConditionOperator = "equals" | "not_equals" | "contains"
