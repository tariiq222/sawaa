import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ContactMessage, EmailTemplate, Notification } from '@prisma/client';
import {
  EmailSettingsResponseDto,
  EmailSettingsTestResultDto,
  SmsDeliveryListResponseDto,
  SmsDeliveryResponseDto,
  SmsSettingsResponseDto,
  SmsSettingsTestResultDto,
} from './comms-settings-response.dto';
import {
  EmailTemplatePreviewResponseDto,
  EmailTemplateResponseDto,
  PaginatedEmailTemplatesResponseDto,
} from './email-template-response.dto';
import {
  ContactMessageResponseDto,
  PaginatedContactMessagesResponseDto,
} from './contact-message-response.dto';
import {
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
  UnreadNotificationCountResponseDto,
} from './notification-response.dto';
import type { GetOrgSmsConfigHandler } from '../../../modules/comms/org-sms-config/get-org-sms-config.handler';
import type { UpsertOrgSmsConfigHandler } from '../../../modules/comms/org-sms-config/upsert-org-sms-config.handler';
import type { TestSmsConfigHandler } from '../../../modules/comms/org-sms-config/test-sms-config.handler';
import type { GetOrgEmailConfigHandler } from '../../../modules/comms/org-email-config/get-org-email-config.handler';
import type { UpsertOrgEmailConfigHandler } from '../../../modules/comms/org-email-config/upsert-org-email-config.handler';
import type { TestEmailConfigHandler } from '../../../modules/comms/org-email-config/test-email-config.handler';
import type { ListSmsDeliveriesHandler } from '../../../modules/comms/list-sms-deliveries/list-sms-deliveries.handler';
import type { CreateEmailTemplateHandler } from '../../../modules/comms/email-templates/create-email-template.handler';
import type { GetEmailTemplateHandler } from '../../../modules/comms/email-templates/get-email-template.handler';
import type { ListEmailTemplatesHandler } from '../../../modules/comms/email-templates/list-email-templates.handler';
import type { UpdateEmailTemplateHandler } from '../../../modules/comms/email-templates/update-email-template.handler';
import type { PreviewEmailTemplateHandler } from '../../../modules/comms/email-templates/preview-email-template.handler';
import type { ListContactMessagesHandler } from '../../../modules/comms/contact-messages/list-contact-messages.handler';
import type { UpdateContactMessageStatusHandler } from '../../../modules/comms/contact-messages/update-contact-message-status.handler';
import type { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import type { GetUnreadCountHandler } from '../../../modules/comms/notifications/get-unread-count.handler';
import type { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';
import type { OrgSmsConfigView } from '../../../modules/comms/org-sms-config/get-org-sms-config.handler';
import type { OrgEmailConfigView } from '../../../modules/comms/org-email-config/get-org-email-config.handler';
import type { TestSmsConfigResult } from '../../../modules/comms/org-sms-config/test-sms-config.handler';
import type { TestEmailConfigResult } from '../../../modules/comms/org-email-config/test-email-config.handler';
import type { ListMeta } from '../../../common/dto';

// ── Compile-time exactness: DTO <=> INFERRED handler output ─────────────────
//
// No handler under src/modules is annotated with a DTO type and none imports
// from this layer (enforced by `git grep -l "api/dashboard/dto" -- src/modules`).
// Every assertion below reads the handler's type, so it proves BOTH that the
// DTO covers what the handler really produces and that it documents nothing
// extra. A few handlers DO carry a module-side return annotation
// (`OrgSmsConfigView`, `OrgEmailConfigView`, `Test*ConfigResult`); those
// annotations live in the comms cluster, not in the API layer, and are exactly
// what the controller hands back, so comparing against them is still a real
// check of the wire shape.

type Expect<T extends true> = T;
type Result<T, M extends keyof T> = T[M] extends (...args: never[]) => Promise<infer R> ? R : never;

/**
 * Structural equality. DTO fields are classes while handlers return object
 * literals or Prisma row types, so identity comparison is useless: `Norm`
 * flattens every object and array element first, then `Extends` checks
 * assignability in BOTH directions. Optionality survives because `Norm` keeps
 * a lone `undefined` in the property type, so `required` vs `optional` is still
 * a mismatch. Negative controls at the bottom prove the helper is not vacuous.
 */
type Prim = string | number | boolean | bigint | symbol | null | undefined | Date;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Norm<T> = IsAny<T> extends true ? T
  : T extends unknown
    ? T extends Prim ? T
    : T extends readonly (infer E)[] ? Norm<E>[]
    : T extends (...a: never[]) => unknown ? T
    : { [K in keyof T]: Norm<T[K]> }
  : never;
type Extends<A, B> = [A] extends [B] ? true : false;
type Equal<A, B> = Extends<Norm<A>, Norm<B>> extends true
  ? Extends<Norm<B>, Norm<A>>
  : false;

/** The canonical list envelope both handlers build with `toListResponse`. */
type Envelope<T> = { items: T[]; meta: ListMeta };

// ── SMS + email provider settings (never carry a secret) ───────────────────

export type GetSmsSettingsMatches = Expect<Equal<Result<GetOrgSmsConfigHandler, 'execute'>, SmsSettingsResponseDto>>;
export type UpsertSmsSettingsMatches = Expect<Equal<Result<UpsertOrgSmsConfigHandler, 'execute'>, SmsSettingsResponseDto>>;
export type TestSmsSettingsMatches = Expect<Equal<Result<TestSmsConfigHandler, 'execute'>, SmsSettingsTestResultDto>>;
export type GetEmailSettingsMatches = Expect<Equal<Result<GetOrgEmailConfigHandler, 'execute'>, EmailSettingsResponseDto>>;
export type UpsertEmailSettingsMatches = Expect<Equal<Result<UpsertOrgEmailConfigHandler, 'execute'>, EmailSettingsResponseDto>>;
export type TestEmailSettingsMatches = Expect<Equal<Result<TestEmailConfigHandler, 'execute'>, EmailSettingsTestResultDto>>;

/**
 * Three of these handlers carry a module-side return annotation (a cluster
 * type, not an API type). Pinning the DTO to that annotation as well makes the
 * chain airtight: DTO === cluster view, and the cluster view is exactly what
 * the controller hands back.
 */
export type SmsSettingsDtoIsClusterView = Expect<Equal<SmsSettingsResponseDto, OrgSmsConfigView>>;
export type EmailSettingsDtoIsClusterView = Expect<Equal<EmailSettingsResponseDto, OrgEmailConfigView>>;
export type TestSmsDtoIsClusterResult = Expect<Equal<SmsSettingsTestResultDto, TestSmsConfigResult>>;
export type TestEmailDtoIsClusterResult = Expect<Equal<EmailSettingsTestResultDto, TestEmailConfigResult>>;

/** The settings view has no credential-bearing key, only the boolean indicator. */
export type SmsSettingsHasNoSecretKey = Expect<
  Extract<'credentialsCiphertext' | 'webhookSecret' | 'credentials' | 'apiKey' | 'apiToken' | 'password', keyof SmsSettingsResponseDto> extends never ? true : false
>;
export type EmailSettingsHasNoSecretKey = Expect<
  Extract<'credentialsCiphertext' | 'credentials' | 'apiKey' | 'pass' | 'password', keyof EmailSettingsResponseDto> extends never ? true : false
>;

// ── SMS deliveries ─────────────────────────────────────────────────────────

export type ListSmsDeliveriesMatches = Expect<
  Equal<Result<ListSmsDeliveriesHandler, 'execute'>, SmsDeliveryListResponseDto>
>;

// ── Email templates ────────────────────────────────────────────────────────

export type CreateEmailTemplateMatches = Expect<Equal<Result<CreateEmailTemplateHandler, 'execute'>, EmailTemplateResponseDto>>;
export type UpdateEmailTemplateMatches = Expect<Equal<Result<UpdateEmailTemplateHandler, 'execute'>, EmailTemplateResponseDto>>;
export type GetEmailTemplateMatches = Expect<Equal<Result<GetEmailTemplateHandler, 'execute'>, EmailTemplateResponseDto | null>>;
export type ListEmailTemplatesMatches = Expect<Equal<Result<ListEmailTemplatesHandler, 'execute'>, PaginatedEmailTemplatesResponseDto>>;
export type PreviewEmailTemplateMatches = Expect<Equal<Result<PreviewEmailTemplateHandler, 'execute'>, EmailTemplatePreviewResponseDto>>;

/** The row DTO is exactly the persisted `EmailTemplate` model. */
export type EmailTemplateMatchesRow = Expect<Equal<EmailTemplateResponseDto, EmailTemplate>>;
export type EmailTemplateListMatchesEnvelope = Expect<Equal<PaginatedEmailTemplatesResponseDto, Envelope<EmailTemplate>>>;
/** The paginated envelope reuses the canonical `ListMetaDto`, which is exactly the handler's `ListMeta`. */
export type EmailTemplateMetaMatchesListMeta = Expect<
  Equal<PaginatedEmailTemplatesResponseDto['meta'], ListMeta>
>;

// ── Inbox: contact messages + notifications ────────────────────────────────

export type ListContactMessagesMatches = Expect<Equal<Result<ListContactMessagesHandler, 'execute'>, PaginatedContactMessagesResponseDto>>;
export type UpdateContactMessageStatusMatches = Expect<Equal<Result<UpdateContactMessageStatusHandler, 'execute'>, ContactMessageResponseDto>>;
export type ContactMessageMatchesRow = Expect<Equal<ContactMessageResponseDto, ContactMessage>>;
export type ContactMessageListMatchesEnvelope = Expect<Equal<PaginatedContactMessagesResponseDto, Envelope<ContactMessage>>>;

export type ListNotificationsMatches = Expect<Equal<Result<ListNotificationsHandler, 'execute'>, PaginatedNotificationsResponseDto>>;
export type NotificationMatchesRow = Expect<Equal<NotificationResponseDto, Notification>>;
export type NotificationListMatchesEnvelope = Expect<Equal<PaginatedNotificationsResponseDto, Envelope<Notification>>>;
export type UnreadCountMatches = Expect<Equal<Result<GetUnreadCountHandler, 'execute'>, UnreadNotificationCountResponseDto>>;
/** `@HttpCode(204)`: the handler returns void and the controller only awaits it. */
export type MarkReadMatches = Expect<Equal<Result<MarkReadHandler, 'execute'>, void>>;

// ── Negative controls: the equality helper is not vacuous ───────────────────

type N_extraKey = Equal<SmsSettingsResponseDto, SmsSettingsResponseDto & { credentialsCiphertext: string }>;
type N_missingKey = Equal<SmsSettingsResponseDto, Omit<SmsSettingsResponseDto, 'credentialsConfigured'>>;
type N_changedType = Equal<SmsSettingsResponseDto, Omit<SmsSettingsResponseDto, 'credentialsConfigured'> & { credentialsConfigured: string }>;
type N_optionality = Equal<SmsSettingsResponseDto, Omit<SmsSettingsResponseDto, 'lastTestOk'> & { lastTestOk?: boolean | null }>;
type N_nullable = Equal<EmailSettingsResponseDto, Omit<EmailSettingsResponseDto, 'senderName'> & { senderName: string }>;
type N_nested = Equal<EmailTemplateResponseDto, Omit<EmailTemplateResponseDto, 'blocks'> & { blocks: unknown[] }>;
type N_wrongRoute = Equal<Result<GetOrgSmsConfigHandler, 'execute'>, EmailSettingsResponseDto>;
type N_envelope = Equal<PaginatedEmailTemplatesResponseDto, { items: EmailTemplateResponseDto[] }>;
export type ControlsReject = Expect<
  [N_extraKey, N_missingKey, N_changedType, N_optionality, N_nullable, N_nested, N_wrongRoute, N_envelope] extends
    [false, false, false, false, false, false, false, false] ? true : false
>;

// ── Schema-level shape assertions ──────────────────────────────────────────

async function buildSchemas(): Promise<Record<string, SchemaObject>> {
  const moduleRef = await Test.createTestingModule({}).compile();
  const app = moduleRef.createNestApplication();
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), {
      extraModels: [
        SmsSettingsResponseDto,
        SmsSettingsTestResultDto,
        EmailSettingsResponseDto,
        EmailSettingsTestResultDto,
        SmsDeliveryResponseDto,
        SmsDeliveryListResponseDto,
        EmailTemplateResponseDto,
        PaginatedEmailTemplatesResponseDto,
        EmailTemplatePreviewResponseDto,
        ContactMessageResponseDto,
        PaginatedContactMessagesResponseDto,
        NotificationResponseDto,
        PaginatedNotificationsResponseDto,
        UnreadNotificationCountResponseDto,
      ],
    });
    return (document.components?.schemas ?? {}) as Record<string, SchemaObject>;
  } finally {
    await app.close();
  }
}

const sorted = (values: readonly string[] | undefined) => [...(values ?? [])].sort();

describe('comms response schemas (output shape)', () => {
  it('documents the SMS settings view without any credential field', async () => {
    const schema = (await buildSchemas()).SmsSettingsResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      [
        'id', 'provider', 'senderId', 'credentialsConfigured', 'lastTestAt', 'lastTestOk', 'createdAt', 'updatedAt',
      ].sort(),
    );
    expect(sorted(schema.required)).toEqual(
      [
        'id', 'provider', 'senderId', 'credentialsConfigured', 'lastTestAt', 'lastTestOk', 'createdAt', 'updatedAt',
      ].sort(),
    );
    expect(schema.properties?.provider).toMatchObject({ type: 'string', enum: ['NONE', 'UNIFONIC', 'TAQNYAT'] });
    expect(schema.properties?.credentialsConfigured).toMatchObject({ type: 'boolean' });
    expect(schema.properties?.lastTestAt).toMatchObject({ type: 'string', format: 'date-time', nullable: true });
    for (const key of ['credentialsCiphertext', 'webhookSecret']) {
      expect(schema.properties?.[key]).toBeUndefined();
    }
  });

  it('documents the email settings view without any credential field', async () => {
    const schema = (await buildSchemas()).EmailSettingsResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      [
        'id', 'provider', 'senderName', 'senderEmail', 'credentialsConfigured', 'lastTestAt', 'lastTestOk',
        'createdAt', 'updatedAt',
      ].sort(),
    );
    expect(schema.properties?.provider).toMatchObject({
      type: 'string',
      enum: ['NONE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILCHIMP'],
    });
    expect(schema.properties?.lastTestOk).toMatchObject({ type: 'boolean', nullable: true });
    expect(schema.properties?.credentialsCiphertext).toBeUndefined();
  });

  it('documents the settings test results with only an optional provider id and bilingual error', async () => {
    const schemas = await buildSchemas();
    expect(sorted(schemas.SmsSettingsTestResultDto.required)).toEqual(['ok']);
    expect(sorted(schemas.EmailSettingsTestResultDto.required)).toEqual(['ok']);
    expect(schemas.SmsSettingsTestResultDto.properties?.providerMessageId).toMatchObject({ type: 'string' });
    expect(schemas.EmailSettingsTestResultDto.properties?.messageId).toMatchObject({ type: 'string' });
    expect(sorted(schemas.CommsBilingualErrorDto.required)).toEqual(['ar', 'en']);
  });

  it('documents the SMS delivery row exactly as the select projects it', async () => {
    const schemas = await buildSchemas();
    const row = schemas.SmsDeliveryResponseDto;
    expect(Object.keys(row.properties ?? {}).sort()).toEqual(
      [
        'id', 'provider', 'toPhone', 'status', 'providerMessageId', 'errorMessage', 'sentAt', 'deliveredAt', 'createdAt',
      ].sort(),
    );
    expect(row.properties?.provider).toMatchObject({
      type: 'string',
      enum: ['NONE', 'UNIFONIC', 'TAQNYAT'],
    });
    expect(row.properties?.status).toMatchObject({
      type: 'string',
      enum: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN'],
    });
    for (const key of ['sentAt', 'deliveredAt', 'providerMessageId', 'errorMessage']) {
      expect(row.properties?.[key]).toMatchObject({ type: 'string', nullable: true });
    }
    expect(schemas.SmsDeliveryListResponseDto.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/SmsDeliveryResponseDto' },
    });
    expect(sorted(schemas.SmsDeliveryListResponseDto.required)).toEqual(['items']);
  });

  it('documents the email template row as the persisted model, blocks as free-form JSON', async () => {
    const schemas = await buildSchemas();
    const schema = schemas.EmailTemplateResponseDto;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ['id', 'slug', 'name', 'subject', 'htmlBody', 'blocks', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
    expect(sorted(schema.required)).toEqual(
      ['id', 'slug', 'name', 'subject', 'htmlBody', 'blocks', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
    expect(schema.properties?.blocks).toMatchObject({ oneOf: expect.any(Array) });
    expect(schema.properties?.blocks).not.toHaveProperty('type');
    const paginated = schemas.PaginatedEmailTemplatesResponseDto;
    expect(sorted(paginated.required)).toEqual(['items', 'meta']);
    expect(paginated.properties?.items).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/EmailTemplateResponseDto' },
    });
    // The envelope reuses the canonical list meta; it keeps its documented `number` shape.
    expect(paginated.properties?.meta).toMatchObject({ allOf: [{ $ref: '#/components/schemas/ListMetaDto' }] });
    expect(sorted(schemas.ListMetaDto.required)).toEqual(
      ['total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage'].sort(),
    );
  });

  it('documents the preview payload as subject + rendered body', async () => {
    const schema = (await buildSchemas()).EmailTemplatePreviewResponseDto;
    expect(sorted(schema.required)).toEqual(['body', 'subject'].sort());
    expect(schema.properties?.subject).toMatchObject({ type: 'string' });
    expect(schema.properties?.body).toMatchObject({ type: 'string' });
  });

  it('leaves the pre-existing inbox schemas untouched', async () => {
    const schemas = await buildSchemas();
    expect(sorted(schemas.ContactMessageResponseDto.required)).toEqual(
      ['id', 'name', 'phone', 'email', 'subject', 'body', 'status', 'createdAt', 'readAt', 'archivedAt'].sort(),
    );
    expect(sorted(schemas.PaginatedContactMessagesResponseDto.required)).toEqual(['items', 'meta']);
    expect(sorted(schemas.NotificationResponseDto.required)).toEqual(
      ['id', 'recipientId', 'recipientType', 'type', 'title', 'body', 'metadata', 'isRead', 'readAt', 'createdAt', 'updatedAt'].sort(),
    );
    expect(schemas.NotificationResponseDto.properties?.metadata).toMatchObject({ oneOf: expect.any(Array) });
    expect(sorted(schemas.PaginatedNotificationsResponseDto.required)).toEqual(['items', 'meta']);
    expect(sorted(schemas.UnreadNotificationCountResponseDto.required)).toEqual(['count']);
  });
});
