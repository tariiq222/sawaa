import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientChatController } from './chat.controller';
import { ChatCompletionHandler } from '../../../modules/ai/chat-completion/chat-completion.handler';
import { ListConversationsHandler } from '../../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../../modules/comms/chat/list-messages.handler';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';

describe('MobileClientChatController (e2e)', () => {
  let app: INestApplication;

  const mockChat = { execute: jest.fn() };
  const mockListConversations = { execute: jest.fn() };
  const mockListMessages = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientChatController],
      providers: [
        { provide: ChatCompletionHandler, useValue: mockChat },
        { provide: ListConversationsHandler, useValue: mockListConversations },
        { provide: ListMessagesHandler, useValue: mockListMessages },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', organizationId: 'org-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const conversationId = '00000000-0000-4000-a000-000000000001';

  describe('POST /mobile/client/chat', () => {
    it('returns 201 on chat message', async () => {
      mockChat.execute.mockResolvedValue({ sessionId: 'sess-1', reply: 'Hello!' });

      const res = await request(app.getHttpServer())
        .post('/mobile/client/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: 'What are your hours?' })
        .expect(201);

      expect(res.body.reply).toBe('Hello!');
      expect(mockChat.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', userMessage: 'What are your hours?' }),
      );
    });

    it('returns 400 for empty message', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: '' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/client/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: 'Hi', extra: 'bad' })
        .expect(400);
    });
  });

  describe('GET /mobile/client/chat/conversations', () => {
    it('returns 200 with conversations', async () => {
      mockListConversations.execute.mockResolvedValue({ data: [{ id: 'c-1' }], total: 1, page: 1, limit: 20 });

      const res = await request(app.getHttpServer())
        .get('/mobile/client/chat/conversations')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListConversations.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', page: 1, limit: 20 }),
      );
    });

    it('passes pagination params', async () => {
      mockListConversations.execute.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });

      await request(app.getHttpServer())
        .get('/mobile/client/chat/conversations?page=2&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListConversations.execute).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-1', page: 2, limit: 10 }),
      );
    });
  });

  describe('GET /mobile/client/chat/conversations/:id/messages', () => {
    it('returns 200 with messages', async () => {
      mockListMessages.execute.mockResolvedValue({ data: [{ id: 'm-1' }], nextCursor: null });

      const res = await request(app.getHttpServer())
        .get(`/mobile/client/chat/conversations/${conversationId}/messages`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(mockListMessages.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId, limit: 30 }),
      );
    });

    it('passes cursor and limit', async () => {
      mockListMessages.execute.mockResolvedValue({ data: [], nextCursor: null });

      await request(app.getHttpServer())
        .get(`/mobile/client/chat/conversations/${conversationId}/messages?cursor=00000000-0000-4000-a000-000000000002&limit=50`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockListMessages.execute).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId, cursor: '00000000-0000-4000-a000-000000000002', limit: 50 }),
      );
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/mobile/client/chat/conversations/not-a-uuid/messages')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
