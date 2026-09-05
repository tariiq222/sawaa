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

  describe('notification OpenAPI contracts', () => {
    it('documents list pagination and its complete response envelope', () => {
      const operation = openApiDocument.paths['/dashboard/comms/notifications']?.get;
      expect(operation?.responses['200']).toMatchObject({
        content: { 'application/json': {
          schema: { $ref: '#/components/schemas/PaginatedNotificationsResponseDto' },
        } },
      });
      expect(operation?.parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'page', in: 'query', required: false,
          schema: expect.objectContaining({ type: 'number', default: 1 }) }),
        expect.objectContaining({ name: 'limit', in: 'query', required: false,
          schema: expect.objectContaining({ type: 'number', default: 20 }) }),
        expect.objectContaining({ name: 'unreadOnly', in: 'query', required: false,
          schema: expect.objectContaining({ type: 'boolean' }) }),
      ]));
      const envelope = schemaObject('PaginatedNotificationsResponseDto');
      expect(envelope.required).toEqual(['items', 'meta']);
      expect(envelope.properties).toMatchObject({
        items: { type: 'array', items: { $ref: '#/components/schemas/NotificationResponseDto' } },
        meta: { allOf: [{ $ref: '#/components/schemas/NotificationListMetaDto' }] },
      });
      const meta = schemaObject('NotificationListMetaDto');
      expect(meta.required?.slice().sort()).toEqual([
        'hasNextPage', 'hasPreviousPage', 'limit', 'page', 'total', 'totalPages',
      ]);
      expect(meta.properties).toMatchObject({
        total: { type: 'number' }, page: { type: 'number' }, limit: { type: 'number' },
        totalPages: { type: 'number' }, hasNextPage: { type: 'boolean' },
        hasPreviousPage: { type: 'boolean' },
      });
    });

    it('documents required fields, nullable data, enums and serialized dates', () => {
      const entity = schemaObject('NotificationResponseDto');
      expect(entity.required?.slice().sort()).toEqual([
        'body', 'createdAt', 'id', 'isRead', 'metadata', 'readAt',
        'recipientId', 'recipientType', 'title', 'type', 'updatedAt',
      ]);
      expect(entity.properties).toMatchObject({
        id: { type: 'string' }, recipientId: { type: 'string' },
        recipientType: { type: 'string', enum: ['CLIENT', 'EMPLOYEE'] },
        type: { type: 'string', enum: [
          'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER',
          'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PAYMENT_COMPLETED', 'PAYMENT_REMINDER',
          'WELCOME', 'GENERAL',
        ] },
        title: { type: 'string' }, body: { type: 'string' }, isRead: { type: 'boolean' },
        metadata: { type: 'object', nullable: true, additionalProperties: true },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      });
    });

    it('documents count and a bodyless 204 for read mutations', () => {
      expect(openApiDocument.paths['/dashboard/comms/notifications/unread-count']?.get?.responses['200'])
        .toMatchObject({ content: { 'application/json': {
          schema: { $ref: '#/components/schemas/NotificationUnreadCountResponseDto' },
        } } });
      expect(schemaObject('NotificationUnreadCountResponseDto')).toMatchObject({
        required: ['count'], properties: { count: { type: 'number' } },
      });
      const operation = openApiDocument.paths['/dashboard/comms/notifications/mark-read']?.patch;
      expect(operation?.responses['204']).toBeDefined();
      expect(operation?.responses['204']).not.toHaveProperty('content');
      expect(operation?.responses['200']).toBeUndefined();
      expect(operation?.requestBody).toMatchObject({ content: { 'application/json': {
        schema: { $ref: '#/components/schemas/MarkReadDto' },
      } } });
      expect(schemaObject('MarkReadDto').required ?? []).toEqual([]);
    });
  });

  describe('GET /dashboard/comms/notifications', () => {
    it.each([null, { bookingId: 'booking-1', nested: { labels: ['reminder'] } }])(
      'preserves the runtime envelope and nullable metadata %p', async (metadata) => {
        const row = {
          id: uuid(1), recipientId: 'user-1', recipientType: 'EMPLOYEE', type: 'GENERAL',
          title: 'Reminder', body: 'Appointment reminder', metadata, isRead: false,
          readAt: null, createdAt: new Date('2026-09-05T09:00:00.000Z'),
          updatedAt: new Date('2026-09-05T09:00:00.000Z'),
        };
        const meta = { total: 1, page: 1, limit: 20, totalPages: 1,
          hasNextPage: false, hasPreviousPage: false };
        mockListNotifications.execute.mockResolvedValue({ items: [row], meta });
        const res = await request(app.getHttpServer()).get('/dashboard/comms/notifications').expect(200);
        expect(res.body).toEqual({ items: [{ ...row,
          createdAt: '2026-09-05T09:00:00.000Z', updatedAt: '2026-09-05T09:00:00.000Z',
        }], meta });
        expect(mockListNotifications.execute).toHaveBeenCalledWith({
          recipientId: 'user-1', unreadOnly: undefined, page: 1, limit: 20,
        });
      },
    );

    it.each(['true', 'false'])('parses pagination and unreadOnly=%s', async (unreadOnly) => {
      mockListNotifications.execute.mockResolvedValue({ items: [], meta: {
        total: 0, page: 2, limit: 5, totalPages: 1, hasNextPage: false, hasPreviousPage: true,
      } });
      await request(app.getHttpServer())
        .get(`/dashboard/comms/notifications?page=2&limit=5&unreadOnly=${unreadOnly}`).expect(200);
      expect(mockListNotifications.execute).toHaveBeenCalledWith({
        recipientId: 'user-1', page: 2, limit: 5, unreadOnly: unreadOnly === 'true',
      });
    });

    it.each(['page=0', 'limit=201', 'unreadOnly=invalid'])('rejects invalid query %s', async (query) => {
      await request(app.getHttpServer()).get(`/dashboard/comms/notifications?${query}`).expect(400);
      expect(mockListNotifications.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /dashboard/comms/notifications/unread-count', () => {
    it.each([0, 5])('returns 200 with count %i', async (count) => {
      mockGetUnreadCount.execute.mockResolvedValue({ count });
      const res = await request(app.getHttpServer())
        .get('/dashboard/comms/notifications/unread-count').expect(200);
      expect(res.body).toEqual({ count });
      expect(mockGetUnreadCount.execute).toHaveBeenCalledWith({ recipientId: 'user-1' });
    });
  });

  describe('PATCH /dashboard/comms/notifications/mark-read', () => {
    it.each([undefined, {}, { notificationId: uuid(1) }])('returns empty 204 for body %p', async (body) => {
      mockMarkRead.execute.mockResolvedValue(undefined);
      const call = request(app.getHttpServer()).patch('/dashboard/comms/notifications/mark-read');
      const res = await (body === undefined ? call : call.send(body)).expect(204);
      expect(res.text).toBe('');
      expect(mockMarkRead.execute).toHaveBeenCalledWith({ recipientId: 'user-1', ...body });
    });

    it.each([{ notificationId: 'bad-id' }, { recipientId: 'another-user' }])(
      'rejects malformed or unexpected fields %p', async (body) => {
        await request(app.getHttpServer()).patch('/dashboard/comms/notifications/mark-read')
          .send(body).expect(400);
        expect(mockMarkRead.execute).not.toHaveBeenCalled();
      },
    );
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
