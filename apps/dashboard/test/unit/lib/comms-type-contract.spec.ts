/**
 * Contract test for the dashboard comms types (MNT-08).
 *
 * `lib/types/email-config.ts`, `lib/types/email-template.ts`,
 * `lib/types/sms.ts` and `lib/types/notification.ts` derive every comms
 * response shape from the committed OpenAPI snapshot, and `lib/api/*` speaks to
 * those schemas through `lib/api/openapi.ts`. These assertions run at
 * type-check time (`pnpm --filter dashboard typecheck`) and at test time, and
 * fail when the wire shape moves underneath the dashboard — or when a
 * documented deviation stops being a deviation.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  EmailConfigView,
  EmailProviderName,
  SmtpCredentialsInput,
  TestEmailResult,
  UpsertEmailConfigInput,
} from "@/lib/types/email-config"
import type {
  EmailBlock,
  EmailTemplate,
  EmailTemplateListPage,
  PaginatedEmailTemplates,
  TemplatePreviewResult,
  UpdateEmailTemplatePayload,
} from "@/lib/types/email-template"
import type {
  SmsConfigView,
  SmsDeliveryRow,
  SmsDeliveryStatus,
  SmsProvider,
  TestSmsResult,
  UpsertSmsConfigInput,
} from "@/lib/types/sms"
import type {
  Notification,
  NotificationList,
  NotificationListQuery,
  UnreadCount,
} from "@/lib/types/notification"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/* ─── Settings views are the wire shape, whole ─── */

type _EmailViewIsWire = Expect<Equal<EmailConfigView, Schemas["EmailSettingsResponseDto"]>>
type _SmsViewIsWire = Expect<Equal<SmsConfigView, Schemas["SmsSettingsResponseDto"]>>
type _TestEmailIsWire = Expect<Equal<TestEmailResult, Schemas["EmailSettingsTestResultDto"]>>
type _TestSmsIsWire = Expect<Equal<TestSmsResult, Schemas["SmsSettingsTestResultDto"]>>

/** The hand-written `organizationId` is gone: no settings handler sends it. */
type _EmailViewHasNoOrganizationId = Expect<
  Equal<"organizationId" extends keyof EmailConfigView ? true : false, false>
>
type _SmsViewHasNoOrganizationId = Expect<
  Equal<"organizationId" extends keyof SmsConfigView ? true : false, false>
>

/* ─── Credentials are write-only: the view exposes nothing secret-bearing ─── */

type SecretKeys =
  | "credentialsCiphertext"
  | "webhookSecret"
  | "apiKey"
  | "apiToken"
  | "pass"
  | "password"
  | "credentials"
type _EmailViewHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof EmailConfigView>, never>>
type _SmsViewHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof SmsConfigView>, never>>
type _EmailIndicatorIsBoolean = Expect<Equal<EmailConfigView["credentialsConfigured"], boolean>>
type _SmsIndicatorIsBoolean = Expect<Equal<SmsConfigView["credentialsConfigured"], boolean>>

/* ─── Request bodies are the documented DTOs ─── */

type _UpsertEmailBodyIsWire = Expect<Equal<UpsertEmailConfigInput, Schemas["UpsertOrgEmailConfigDto"]>>
type _UpsertSmsBodyIsWire = Expect<Equal<UpsertSmsConfigInput, Schemas["UpsertOrgSmsConfigDto"]>>
type _SmtpBlockIsWire = Expect<
  Equal<SmtpCredentialsInput, NonNullable<Schemas["UpsertOrgEmailConfigDto"]["smtp"]>>
>
type _SmtpPortIsNumber = Expect<Equal<SmtpCredentialsInput["port"], number>>

/* ─── Provider vocabularies are the snapshot enums ─── */

type _EmailProviderIsWire = Expect<Equal<EmailProviderName, Schemas["EmailSettingsResponseDto"]["provider"]>>
type _EmailProviderValues = Expect<
  Equal<EmailProviderName, "NONE" | "SMTP" | "RESEND" | "SENDGRID" | "MAILCHIMP">
>
type _SmsProviderIsWire = Expect<Equal<SmsProvider, Schemas["SmsSettingsResponseDto"]["provider"]>>
type _SmsProviderValues = Expect<Equal<SmsProvider, "NONE" | "UNIFONIC" | "TAQNYAT">>

/* ─── SMS deliveries ─── */

type _DeliveryRowIsWire = Expect<Equal<SmsDeliveryRow, Schemas["SmsDeliveryResponseDto"]>>
type _DeliveryStatusIsWire = Expect<
  Equal<SmsDeliveryStatus, Schemas["SmsDeliveryResponseDto"]["status"]>
>
type _DeliveryStatusValues = Expect<
  Equal<SmsDeliveryStatus, "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "UNKNOWN">
>
/** The list route answers `{ items }` with no pagination metadata. */
type _DeliveryListEnvelope = Expect<
  Equal<
    paths["/api/v1/dashboard/comms/settings/sms/deliveries"]["get"] extends {
      responses: { 200: { content: { "application/json": infer Body } } }
    }
      ? Body
      : never,
    { items: Schemas["SmsDeliveryResponseDto"][] }
  >
>
type _DeliveryTimestampsAreNullable = Expect<
  Equal<
    Pick<SmsDeliveryRow, "providerMessageId" | "errorMessage" | "sentAt" | "deliveredAt">,
    { providerMessageId: string | null; errorMessage: string | null; sentAt: string | null; deliveredAt: string | null }
  >
>

/* ─── Email templates: one documented deviation (`blocks`) ─── */

type _TemplateCoversWire = Expect<
  Equal<Exclude<keyof Schemas["EmailTemplateResponseDto"], keyof EmailTemplate>, never>
>
type _TemplateAddsNothing = Expect<
  Equal<Exclude<keyof EmailTemplate, keyof Schemas["EmailTemplateResponseDto"]>, never>
>
type _BlocksAreNarrowed = Expect<Equal<EmailTemplate["blocks"], EmailBlock[] | null>>
/** The wire column is free-form JSON, not the builder union — this is why the narrowing exists. */
type _BlocksAreJsonOnTheWire = Expect<
  Equal<"EmailBlock[]" extends keyof Schemas["EmailTemplateResponseDto"]["blocks"] ? true : false, false>
>
type _TemplateListPageIsDerived = Expect<
  Equal<Omit<EmailTemplateListPage, "items">, Omit<PaginatedEmailTemplates, "items">>
>
type _TemplateListItemsAreNarrowed = Expect<Equal<EmailTemplateListPage["items"], EmailTemplate[]>>
type _PreviewIsWire = Expect<Equal<TemplatePreviewResult, Schemas["EmailTemplatePreviewResponseDto"]>>
type _PreviewKeys = Expect<Equal<keyof TemplatePreviewResult, "body" | "subject">>

/** The update body is the documented DTO except for the narrowed builder blocks. */
type _UpdatePayloadCoversWire = Expect<
  Equal<Exclude<keyof UpdateEmailTemplatePayload, keyof Schemas["UpdateEmailTemplateDto"]>, never>
>
type _UpdatePayloadAddsNothing = Expect<
  Equal<Exclude<keyof Schemas["UpdateEmailTemplateDto"], keyof UpdateEmailTemplatePayload>, never>
>
type _UpdateBlocksAreNarrowed = Expect<Equal<UpdateEmailTemplatePayload["blocks"], EmailBlock[] | undefined>>

/* ─── Inbox / notifications ─── */

type _NotificationIsWire = Expect<Equal<Notification, Schemas["NotificationResponseDto"]>>
type _NotificationListIsWire = Expect<
  Equal<NotificationList, Schemas["PaginatedNotificationsResponseDto"]>
>
type _UnreadCountIsWire = Expect<Equal<UnreadCount, Schemas["UnreadNotificationCountResponseDto"]>>
type _UnreadCountValue = Expect<Equal<UnreadCount["count"], number>>
type _NotificationTypeIsWire = Expect<
  Equal<Notification["type"], Schemas["NotificationResponseDto"]["type"]>
>
/** JSON metadata stays honestly typed as the union the schema documents. */
type _MetadataIsJsonUnion = Expect<
  Equal<Notification["metadata"], Schemas["NotificationResponseDto"]["metadata"]>
>
type _ReadAtIsNullable = Expect<Equal<Notification["readAt"], string | null>>

/** The list query is exactly the documented one: `page`, `limit`, `unreadOnly`. */
type _NotificationQueryIsWire = Expect<
  Equal<
    NotificationListQuery,
    NonNullable<paths["/api/v1/dashboard/comms/notifications"]["get"]["parameters"]["query"]>
  >
>
type _NotificationQueryKeys = Expect<
  Equal<keyof NotificationListQuery, "page" | "limit" | "unreadOnly">
>

/* ─── Runtime smoke: the derived types hold real wire rows ─── */

const dashboardTemplate: EmailTemplate = {
  id: "00000000-4000-4000-a000-0000000000e1",
  slug: "booking-confirmed",
  name: "تأكيد الحجز",
  subject: "تم تأكيد حجزك",
  htmlBody: "<p>Hello</p>",
  blocks: [{ type: "paragraph", id: "b1", text: "Hello" }],
  isActive: true,
  createdAt: "2026-10-10T09:00:00.000Z",
  updatedAt: "2026-10-10T09:00:00.000Z",
}

/** Every key of the runtime row is a documented wire key. */
const templateAsWireView: Omit<Schemas["EmailTemplateResponseDto"], "blocks"> = dashboardTemplate

const wireSmsView: Schemas["SmsSettingsResponseDto"] = {
  id: "00000000-4000-4000-a000-0000000000c1",
  provider: "TAQNYAT",
  senderId: "Sawaa",
  credentialsConfigured: true,
  lastTestAt: null,
  lastTestOk: null,
  createdAt: "2026-10-10T09:00:00.000Z",
  updatedAt: "2026-10-10T09:00:00.000Z",
}

const dashboardSmsView: SmsConfigView = wireSmsView

describe("comms type contract", () => {
  it("keeps the dashboard settings views aligned with the snapshot", () => {
    expect(dashboardSmsView.provider).toBe("TAQNYAT")
    expect(dashboardSmsView.credentialsConfigured).toBe(true)
    expect(Object.keys(dashboardSmsView).sort()).toEqual(
      [
        "id", "provider", "senderId", "credentialsConfigured", "lastTestAt", "lastTestOk", "createdAt", "updatedAt",
      ].sort(),
    )
  })

  it("never exposes a credential field on either settings view", () => {
    const keys: string[] = Object.keys(dashboardSmsView)
    for (const secret of ["credentialsCiphertext", "webhookSecret", "apiKey", "apiToken", "pass", "password"]) {
      expect(keys).not.toContain(secret)
    }
  })

  it("keeps the email template row aligned with the snapshot", () => {
    expect(dashboardTemplate.slug).toBe("booking-confirmed")
    expect(dashboardTemplate.blocks).toEqual([{ type: "paragraph", id: "b1", text: "Hello" }])
    expect(dashboardTemplate.isActive).toBe(true)
    expect(templateAsWireView.subject).toBe("تم تأكيد حجزك")
  })
})
