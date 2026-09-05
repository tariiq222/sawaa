import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardCommsController } from './comms.controller';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { GetUnreadCountHandler } from '../../modules/comms/notifications/get-unread-count.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { PreviewEmailTemplateHandler } from '../../modules/comms/email-templates/preview-email-template.handler';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';
import { GetConversationHandler } from '../../modules/comms/chat/get-conversation.handler';
import { CloseConversationHandler } from '../../modules/comms/chat/close-conversation.handler';
import { SendStaffMessageHandler } from '../../modules/comms/chat/send-staff-message.handler';
import { ListContactMessagesHandler } from '../../modules/comms/contact-messages/list-contact-messages.handler';
import { UpdateContactMessageStatusHandler } from '../../modules/comms/contact-messages/update-contact-message-status.handler';
import { GetOrgSmsConfigHandler } from '../../modules/comms/org-sms-config/get-org-sms-config.handler';
import { UpsertOrgSmsConfigHandler } from '../../modules/comms/org-sms-config/upsert-org-sms-config.handler';
import { TestSmsConfigHandler } from '../../modules/comms/org-sms-config/test-sms-config.handler';
import { GetOrgEmailConfigHandler } from '../../modules/comms/org-email-config/get-org-email-config.handler';
import { UpsertOrgEmailConfigHandler } from '../../modules/comms/org-email-config/upsert-org-email-config.handler';
import { TestEmailConfigHandler } from '../../modules/comms/org-email-config/test-email-config.handler';
import { ListSmsDeliveriesHandler } from '../../modules/comms/list-sms-deliveries/list-sms-deliveries.handler';
import { ListTenantDeliveryLogsHandler } from '../../modules/comms/list-tenant-delivery-logs/list-tenant-delivery-logs.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import {
  DocumentBuilder,
  OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

describe('DashboardCommsController (e2e)', () => {
  let app: INestApplication;
  let openApiDocument: OpenAPIObject;

  const mockListNotifications = { execute: jest.fn() };
  const mockGetUnreadCount = { execute: jest.fn() };
  const mockMarkRead = { execute: jest.fn() };
  const mockListEmailTemplates = { execute: jest.fn() };
  const mockGetEmailTemplate = { execute: jest.fn() };
  const mockCreateEmailTemplate = { execute: jest.fn() };
  const mockUpdateEmailTemplate = { execute: jest.fn() };
  const mockPreviewEmailTemplate = { execute: jest.fn() };
  const mockListConversations = { execute: jest.fn() };
  const mockListMessages = { execute: jest.fn() };
  const mockGetConversation = { execute: jest.fn() };
  const mockCloseConversation = { execute: jest.fn() };
  const mockSendStaffMessage = { execute: jest.fn() };
  const mockListContactMessages = { execute: jest.fn() };
  const mockUpdateContactMessageStatus = { execute: jest.fn() };
  const mockGetOrgSmsConfig = { execute: jest.fn() };
  const mockUpsertOrgSmsConfig = { execute: jest.fn() };
  const mockTestSmsConfig = { execute: jest.fn() };
  const mockGetOrgEmailConfig = { execute: jest.fn() };
  const mockUpsertOrgEmailConfig = { execute: jest.fn() };
  const mockTestEmailConfig = { execute: jest.fn() };
  const mockListSmsDeliveries = { execute: jest.fn() };
  const mockListTenantDeliveryLogs = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardCommsController],
      providers: [
        { provide: ListNotificationsHandler, useValue: mockListNotifications },
        { provide: GetUnreadCountHandler, useValue: mockGetUnreadCount },
        { provide: MarkReadHandler, useValue: mockMarkRead },
        { provide: ListEmailTemplatesHandler, useValue: mockListEmailTemplates },
        { provide: GetEmailTemplateHandler, useValue: mockGetEmailTemplate },
        { provide: CreateEmailTemplateHandler, useValue: mockCreateEmailTemplate },
        { provide: UpdateEmailTemplateHandler, useValue: mockUpdateEmailTemplate },
        { provide: PreviewEmailTemplateHandler, useValue: mockPreviewEmailTemplate },
        { provide: ListConversationsHandler, useValue: mockListConversations },
        { provide: ListMessagesHandler, useValue: mockListMessages },
        { provide: GetConversationHandler, useValue: mockGetConversation },
        { provide: CloseConversationHandler, useValue: mockCloseConversation },
        { provide: SendStaffMessageHandler, useValue: mockSendStaffMessage },
        { provide: ListContactMessagesHandler, useValue: mockListContactMessages },
        { provide: UpdateContactMessageStatusHandler, useValue: mockUpdateContactMessageStatus },
        { provide: GetOrgSmsConfigHandler, useValue: mockGetOrgSmsConfig },
        { provide: UpsertOrgSmsConfigHandler, useValue: mockUpsertOrgSmsConfig },
        { provide: TestSmsConfigHandler, useValue: mockTestSmsConfig },
        { provide: GetOrgEmailConfigHandler, useValue: mockGetOrgEmailConfig },
        { provide: UpsertOrgEmailConfigHandler, useValue: mockUpsertOrgEmailConfig },
        { provide: TestEmailConfigHandler, useValue: mockTestEmailConfig },
        { provide: ListSmsDeliveriesHandler, useValue: mockListSmsDeliveries },
        { provide: ListTenantDeliveryLogsHandler, useValue: mockListTenantDeliveryLogs },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'user-1',
            id: 'user-1',
            email: 'admin@example.com',
            role: 'ADMIN',
            isSuperAdmin: false,
          };
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    openApiDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Dashboard comms contract test').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  function schemaObject(name: string): SchemaObject {
    const schema = openApiDocument.components?.schemas?.[name];
    if (!schema || '$ref' in schema) throw new Error(`Missing object schema: ${name}`);
    return schema;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  describe('Notification OpenAPI response contracts', () => {
    it('documents list and unread-count envelopes', () => {
      expect(openApiDocument.paths['/dashboard/comms/notifications']?.get?.responses?.['200'])
        .toMatchObject({
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedNotificationsResponseDto' },
            },
          },
        });

      expect(openApiDocument.paths['/dashboard/comms/notifications/unread-count']
        ?.get?.responses?.['200'])
        .toMatchObject({
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UnreadNotificationCountResponseDto' },
            },
          },
        });
    });

    it('documents the no-content mark-read response', () => {
      const responses = openApiDocument.paths['/dashboard/comms/notifications/mark-read']
        ?.patch?.responses;

      expect(responses?.['204']).toMatchObject({ description: expect.any(String) });
      expect(responses?.['200']).toBeUndefined();
    });

    it('documents notification fields, Prisma enums, nullable timestamps, and JSON metadata', () => {
      const notification = schemaObject('NotificationResponseDto');
      expect(notification.required).toEqual(expect.arrayContaining([
        'id', 'recipientId', 'recipientType', 'type', 'title', 'body', 'metadata',
        'isRead', 'readAt', 'createdAt', 'updatedAt',
      ]));
      expect(notification.properties).toMatchObject({
        recipientType: { type: 'string', enum: ['CLIENT', 'EMPLOYEE'] },
        type: {
          type: 'string',
          enum: [
            'BOOKING_CREATED',
            'BOOKING_CONFIRMED',
            'BOOKING_CANCELLED',
            'BOOKING_REMINDER',
            'PAYMENT_RECEIVED',
            'PAYMENT_FAILED',
            'PAYMENT_COMPLETED',
            'PAYMENT_REMINDER',
            'WELCOME',
            'GENERAL',
          ],
        },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      });

      const metadata = notification.properties?.metadata as SchemaObject & {
        oneOf?: Array<SchemaObject>;
      };
      expect(metadata.type).toBeUndefined();
      expect(metadata.oneOf).toEqual(expect.arrayContaining([
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'array', items: {} },
        { type: 'object', additionalProperties: true, nullable: true },
      ]));
    });

    it('documents complete pagination metadata and numeric filtered queries', () => {
      const response = schemaObject('PaginatedNotificationsResponseDto');
      expect(response.required).toEqual(expect.arrayContaining(['items', 'meta']));
      expect(response.properties?.items).toMatchObject({
        type: 'array',
        items: { $ref: '#/components/schemas/NotificationResponseDto' },
      });
      expect(response.properties?.meta).toMatchObject({
        allOf: [{ $ref: '#/components/schemas/NotificationListMetaDto' }],
      });
      expect(schemaObject('NotificationListMetaDto').required).toEqual([
        'total', 'page', 'limit', 'totalPages', 'hasNextPage', 'hasPreviousPage',
      ]);

      const parameters = openApiDocument.paths['/dashboard/comms/notifications']
        ?.get?.parameters ?? [];
      const queryParameter = (name: string) => parameters.find(
        (parameter) => 'name' in parameter && parameter.name === name,
      );
      expect(queryParameter('page')).toMatchObject({
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
      });
      expect(queryParameter('limit')).toMatchObject({
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      });
      expect(queryParameter('unreadOnly')).toMatchObject({
        in: 'query',
        schema: { type: 'boolean' },
      });
    });
  });

  describe('GET /dashboard/comms/notifications', () => {
    it('returns a realistic paginated notification envelope and passes numeric filters', async () => {
      mockListNotifications.execute.mockResolvedValue({
        items: [{
          id: uuid(1),
          recipientId: 'user-1',
          recipientType: 'EMPLOYEE',
          type: 'BOOKING_CREATED',
          title: 'New booking',
          body: 'A client created a booking',
          metadata: ['booking-1', 2, true, null, { source: 'dashboard' }],
          isRead: false,
          readAt: null,
          createdAt: new Date('2026-09-05T08:00:00.000Z'),
          updatedAt: new Date('2026-09-05T08:00:00.000Z'),
        }],
        meta: {
          total: 21,
          page: 2,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/notifications?page=2&limit=10&unreadOnly=true')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        id: uuid(1),
        recipientType: 'EMPLOYEE',
        type: 'BOOKING_CREATED',
        metadata: ['booking-1', 2, true, null, { source: 'dashboard' }],
        readAt: null,
        createdAt: '2026-09-05T08:00:00.000Z',
      });
      expect(res.body.meta).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(mockListNotifications.execute).toHaveBeenCalledWith(
        { recipientId: 'user-1', unreadOnly: true, page: 2, limit: 10 },
      );
    });

    it('uses local default pagination values', async () => {
      mockListNotifications.execute.mockResolvedValue({ items: [], meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      } });

      await request(app.getHttpServer())
        .get('/dashboard/comms/notifications')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListNotifications.execute).toHaveBeenCalledWith({
        recipientId: 'user-1',
        unreadOnly: undefined,
        page: 1,
        limit: 20,
      });
    });

    it.each([
      ['page=0', '?page=0'],
      ['limit=201', '?limit=201'],
      ['unreadOnly=invalid', '?unreadOnly=invalid'],
    ])('rejects invalid notification query (%s)', async (_label, query) => {
      await request(app.getHttpServer())
        .get(`/dashboard/comms/notifications${query}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/comms/notifications/unread-count', () => {
    it('returns 200 with unread count', async () => {
      mockGetUnreadCount.execute.mockResolvedValue({ count: 5 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/notifications/unread-count')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.count).toBe(5);
    });
  });

  describe('PATCH /dashboard/comms/notifications/mark-read', () => {
    it('returns 204 and marks all notifications when the body is empty', async () => {
      mockMarkRead.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/dashboard/comms/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .send({})
        .expect(204);

      expect(mockMarkRead.execute).toHaveBeenCalledWith({ recipientId: 'user-1' });
    });

    it('returns 204 and marks one notification when notificationId is provided', async () => {
      mockMarkRead.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/dashboard/comms/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ notificationId: uuid(1) })
        .expect(204);

      expect(mockMarkRead.execute).toHaveBeenCalledWith({
        recipientId: 'user-1',
        notificationId: uuid(1),
      });
    });

    it('rejects an invalid notificationId', async () => {
      await request(app.getHttpServer())
        .patch('/dashboard/comms/notifications/mark-read')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ notificationId: 'not-a-uuid' })
        .expect(400);
    });
  });

  // ── Email Templates ────────────────────────────────────────────────────────

  describe('GET /dashboard/comms/email-templates', () => {
    it('returns 200 with email template list', async () => {
      mockListEmailTemplates.execute.mockResolvedValue({ data: [{ id: uuid(2), name: 'Welcome' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/email-templates')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data[0].name).toBe('Welcome');
    });
  });

  describe('POST /dashboard/comms/email-templates', () => {
    it('returns 201 on valid creation', async () => {
      mockCreateEmailTemplate.execute.mockResolvedValue({ id: uuid(2), name: 'Welcome' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/comms/email-templates')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ slug: 'welcome', name: 'Welcome', subject: 'Welcome to our clinic', htmlBody: '<p>Hello</p>' })
        .expect(201);

      expect(res.body.name).toBe('Welcome');
    });
  });

  describe('GET /dashboard/comms/email-templates/:id', () => {
    it('returns 200 with template details', async () => {
      mockGetEmailTemplate.execute.mockResolvedValue({ id: uuid(2), name: 'Welcome' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/comms/email-templates/${uuid(2)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.name).toBe('Welcome');
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/comms/email-templates/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/comms/email-templates/:id', () => {
    it('returns 200 on update', async () => {
      mockUpdateEmailTemplate.execute.mockResolvedValue({ id: uuid(2), name: 'Welcome Updated' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/comms/email-templates/${uuid(2)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ subject: 'Updated subject' })
        .expect(200);

      expect(res.body.name).toBe('Welcome Updated');
    });
  });

  // ── Chat ───────────────────────────────────────────────────────────────────

  describe('GET /dashboard/comms/chat/conversations', () => {
    it('returns 200 with conversation list', async () => {
      mockListConversations.execute.mockResolvedValue({ data: [{ id: uuid(3) }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/chat/conversations')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /dashboard/comms/chat/conversations/:id', () => {
    it('returns 200 with conversation details', async () => {
      mockGetConversation.execute.mockResolvedValue({ id: uuid(3), status: 'OPEN' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/comms/chat/conversations/${uuid(3)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('OPEN');
    });
  });

  describe('PATCH /dashboard/comms/chat/conversations/:id/close', () => {
    it('returns 200 on close', async () => {
      mockCloseConversation.execute.mockResolvedValue({ id: uuid(3), status: 'CLOSED' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/comms/chat/conversations/${uuid(3)}/close`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.status).toBe('CLOSED');
    });
  });

  describe('POST /dashboard/comms/chat/conversations/:id/messages', () => {
    it('returns 201 on send message', async () => {
      mockSendStaffMessage.execute.mockResolvedValue({ id: 'msg-1', body: 'Hello' });

      const res = await request(app.getHttpServer())
        .post(`/dashboard/comms/chat/conversations/${uuid(3)}/messages`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ body: 'Hello' })
        .expect(201);

      expect(res.body.body).toBe('Hello');
      expect(mockSendStaffMessage.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: uuid(3), staffId: 'user-1', body: 'Hello' }),
      );
    });
  });

  // ── Contact Messages ───────────────────────────────────────────────────────

  describe('contact message OpenAPI contracts', () => {
    it('documents list query, paginated response, entity, and update responses', () => {
      const listOperation = openApiDocument.paths['/dashboard/comms/contact-messages']?.get;
      expect(listOperation?.parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'page', in: 'query', required: false,
          schema: expect.objectContaining({ type: 'number' }),
        }),
        expect.objectContaining({
          name: 'limit', in: 'query', required: false,
          schema: expect.objectContaining({ type: 'number' }),
        }),
        expect.objectContaining({
          name: 'status', in: 'query', required: false,
          schema: { type: 'string', enum: ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] },
        }),
      ]));
      expect(listOperation?.responses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PaginatedContactMessagesResponseDto' },
          },
        },
      });

      const updateResponses = openApiDocument.paths[
        '/dashboard/comms/contact-messages/{id}/status'
      ]?.patch?.responses;
      expect(updateResponses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ContactMessageResponseDto' },
          },
        },
      });
      expect(updateResponses?.['404']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiErrorDto' },
          },
        },
      });

      const messageSchema = schemaObject('ContactMessageResponseDto');
      expect(Object.keys(messageSchema.properties ?? {}).sort()).toEqual([
        'archivedAt',
        'body',
        'createdAt',
        'email',
        'id',
        'name',
        'phone',
        'readAt',
        'status',
        'subject',
      ]);
      expect(messageSchema.properties).toMatchObject({
        id: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        subject: { type: 'string', nullable: true },
        body: { type: 'string' },
        status: { type: 'string', enum: ['NEW', 'READ', 'REPLIED', 'ARCHIVED'] },
        createdAt: { type: 'string', format: 'date-time' },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        archivedAt: { type: 'string', format: 'date-time', nullable: true },
      });
      expect([...(messageSchema.required ?? [])].sort()).toEqual([
        'archivedAt',
        'body',
        'createdAt',
        'email',
        'id',
        'name',
        'phone',
        'readAt',
        'status',
        'subject',
      ]);

      const paginatedSchema = schemaObject('PaginatedContactMessagesResponseDto');
      expect(paginatedSchema.properties).toMatchObject({
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/ContactMessageResponseDto' },
        },
        meta: {
          allOf: [{ $ref: '#/components/schemas/ContactMessageListMetaDto' }],
        },
      });

      const metaSchema = schemaObject('ContactMessageListMetaDto');
      expect(Object.keys(metaSchema.properties ?? {}).sort()).toEqual([
        'hasNextPage',
        'hasPreviousPage',
        'limit',
        'page',
        'total',
        'totalPages',
      ]);
      expect(metaSchema.properties).toMatchObject({
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
        hasNextPage: { type: 'boolean' },
        hasPreviousPage: { type: 'boolean' },
      });
    });
  });

  describe('GET /dashboard/comms/contact-messages', () => {
    it('returns 200 with contact messages', async () => {
      mockListContactMessages.execute.mockResolvedValue({
        items: [{ id: uuid(4) }],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/contact-messages')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });

  describe('PATCH /dashboard/comms/contact-messages/:id/status', () => {
    it('returns 200 on status update', async () => {
      mockUpdateContactMessageStatus.execute.mockResolvedValue({ id: uuid(4), status: 'REPLIED' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/comms/contact-messages/${uuid(4)}/status`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ status: 'REPLIED' })
        .expect(200);

      expect(res.body.status).toBe('REPLIED');
    });
  });

  // ── Settings ───────────────────────────────────────────────────────────────

  describe('GET /dashboard/comms/settings/sms', () => {
    it('returns 200 with SMS config', async () => {
      mockGetOrgSmsConfig.execute.mockResolvedValue({ provider: 'TWILIO', senderId: 'CLINIC' });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/settings/sms')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.provider).toBe('TWILIO');
    });
  });

  describe('GET /dashboard/comms/settings/email', () => {
    it('returns 200 with email config', async () => {
      mockGetOrgEmailConfig.execute.mockResolvedValue({ provider: 'SENDGRID', fromEmail: 'noreply@example.com' });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/settings/email')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.fromEmail).toBe('noreply@example.com');
    });
  });

  describe('GET /dashboard/comms/settings/sms/deliveries', () => {
    it('returns 200 with delivery logs', async () => {
      mockListSmsDeliveries.execute.mockResolvedValue({ items: [{ id: uuid(5), status: 'DELIVERED' }] });

      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/settings/sms/deliveries')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListSmsDeliveries.execute).toHaveBeenCalledWith();
      expect(res.body.items).toHaveLength(1);
    });
  });
});
