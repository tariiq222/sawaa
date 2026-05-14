import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardAiController } from './ai.controller';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';
import { GetChatbotConfigHandler } from '../../modules/ai/chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from '../../modules/ai/chatbot-config/upsert-chatbot-config.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardAiController (e2e)', () => {
  let app: INestApplication;

  const mockKnowledgeBase = {
    listDocuments: jest.fn(),
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
  };
  const mockChatCompletion = { execute: jest.fn() };
  const mockGetChatbotConfig = { execute: jest.fn() };
  const mockUpsertChatbotConfig = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardAiController],
      providers: [
        { provide: ManageKnowledgeBaseHandler, useValue: mockKnowledgeBase },
        { provide: ChatCompletionHandler, useValue: mockChatCompletion },
        { provide: GetChatbotConfigHandler, useValue: mockGetChatbotConfig },
        { provide: UpsertChatbotConfigHandler, useValue: mockUpsertChatbotConfig },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
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

  const docId = '00000000-0000-4000-a000-000000000001';

  describe('GET /dashboard/ai/knowledge-base', () => {
    it('returns 200 with paginated documents', async () => {
      mockKnowledgeBase.listDocuments.mockResolvedValue({
        data: [{ id: docId, title: 'FAQ' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/ai/knowledge-base')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('passes status filter', async () => {
      mockKnowledgeBase.listDocuments.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });

      await request(app.getHttpServer())
        .get('/dashboard/ai/knowledge-base?status=ACTIVE&page=1&limit=10')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockKnowledgeBase.listDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
      );
    });

    it('returns 400 for invalid status', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/ai/knowledge-base?status=INVALID')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/ai/knowledge-base/:id', () => {
    it('returns 200 with document details', async () => {
      mockKnowledgeBase.getDocument.mockResolvedValue({ id: docId, title: 'FAQ', content: '...' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/ai/knowledge-base/${docId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.title).toBe('FAQ');
      expect(mockKnowledgeBase.getDocument).toHaveBeenCalledWith({ documentId: docId });
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/ai/knowledge-base/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('PATCH /dashboard/ai/knowledge-base/:id', () => {
    it('returns 200 on update', async () => {
      mockKnowledgeBase.updateDocument.mockResolvedValue({ id: docId, title: 'Updated FAQ' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/ai/knowledge-base/${docId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ title: 'Updated FAQ' })
        .expect(200);

      expect(res.body.title).toBe('Updated FAQ');
      expect(mockKnowledgeBase.updateDocument).toHaveBeenCalledWith({ documentId: docId, title: 'Updated FAQ' });
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .patch(`/dashboard/ai/knowledge-base/${docId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ title: 'Test', extra: 'bad' })
        .expect(400);
    });
  });

  describe('DELETE /dashboard/ai/knowledge-base/:id', () => {
    it('returns 204 on delete', async () => {
      mockKnowledgeBase.deleteDocument.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/dashboard/ai/knowledge-base/${docId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);

      expect(mockKnowledgeBase.deleteDocument).toHaveBeenCalledWith({ documentId: docId });
    });
  });

  describe('GET /dashboard/ai/chatbot-config', () => {
    it('returns 200 with config', async () => {
      mockGetChatbotConfig.execute.mockResolvedValue({ id: 'cfg-1', isEnabled: true });

      const res = await request(app.getHttpServer())
        .get('/dashboard/ai/chatbot-config')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.isEnabled).toBe(true);
    });
  });

  describe('PATCH /dashboard/ai/chatbot-config', () => {
    it('returns 200 on upsert', async () => {
      mockUpsertChatbotConfig.execute.mockResolvedValue({ id: 'cfg-1', isEnabled: false });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/ai/chatbot-config')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ isEnabled: false, greetingAr: 'مرحباً' })
        .expect(200);

      expect(res.body.isEnabled).toBe(false);
    });

    it('returns 400 for invalid escalateToHumanAt', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/ai/chatbot-config')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ escalateToHumanAt: 0 })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .patch('/dashboard/ai/chatbot-config')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /dashboard/ai/chat', () => {
    it('returns 200 with chat completion', async () => {
      mockChatCompletion.execute.mockResolvedValue({ sessionId: 'sess-1', reply: 'Hello!', sourcesUsed: 2 });

      const res = await request(app.getHttpServer())
        .post('/dashboard/ai/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: 'What are your hours?' })
        .expect(200);

      expect(res.body.reply).toBe('Hello!');
    });

    it('returns 400 for empty message', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/ai/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: '' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/ai/chat')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ userMessage: 'Hi', extra: 'bad' })
        .expect(400);
    });
  });
});
