import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardAiController } from './ai.controller';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';
import { GetChatbotConfigHandler } from '../../modules/ai/chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from '../../modules/ai/chatbot-config/upsert-chatbot-config.handler';
import { GetAiProviderConfigHandler } from '../../modules/ai/provider-config/get-ai-provider-config.handler';
import { UpsertAiProviderConfigHandler } from '../../modules/ai/provider-config/upsert-ai-provider-config.handler';
import { TestAiProviderConfigHandler } from '../../modules/ai/provider-config/test-ai-provider-config.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardAiController provider permissions (real CaslGuard)', () => {
  let app: INestApplication;
  let permissions: Array<{ action: string; subject: string }>;
  const getProvider = { execute: jest.fn().mockResolvedValue({ hasCredential: false }) };
  const upsertProvider = { execute: jest.fn().mockResolvedValue({}) };
  const testProvider = { execute: jest.fn().mockResolvedValue({ ok: true }) };
  const noop = { execute: jest.fn().mockResolvedValue({}), listDocuments: jest.fn(), getDocument: jest.fn(), createDocument: jest.fn(), updateDocument: jest.fn(), publishDocument: jest.fn(), unpublishDocument: jest.fn(), reindexDocument: jest.fn(), deleteDocument: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardAiController],
      providers: [
        { provide: ManageKnowledgeBaseHandler, useValue: noop }, { provide: ChatCompletionHandler, useValue: noop },
        { provide: GetChatbotConfigHandler, useValue: noop }, { provide: UpsertChatbotConfigHandler, useValue: noop },
        { provide: GetAiProviderConfigHandler, useValue: getProvider }, { provide: UpsertAiProviderConfigHandler, useValue: upsertProvider },
        { provide: TestAiProviderConfigHandler, useValue: testProvider },
      ],
    }).overrideGuard(JwtGuard).useValue({ canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { sub: 'user-1', role: 'CUSTOM', customRole: null, permissions };
      return true;
    }}).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app.close());

  it('allows Setting read to GET config and models but forbids PUT and test', async () => {
    permissions = [{ action: 'read', subject: 'Setting' }];
    await request(app.getHttpServer()).get('/dashboard/ai/provider-config').expect(200);
    await request(app.getHttpServer()).get('/dashboard/ai/provider-config/models').expect(200);
    await request(app.getHttpServer()).put('/dashboard/ai/provider-config').send({ provider: 'OPENAI', model: 'gpt-4o-mini' }).expect(403);
    await request(app.getHttpServer()).post('/dashboard/ai/provider-config/test').send({ provider: 'OPENAI', model: 'gpt-4o-mini', candidateApiKey: 'candidate-key' }).expect(403);
  });

  it('allows Setting manage to mutate provider settings', async () => {
    permissions = [{ action: 'manage', subject: 'Setting' }];
    await request(app.getHttpServer()).put('/dashboard/ai/provider-config').send({ provider: 'OPENAI', model: 'gpt-4o-mini' }).expect(200);
    await request(app.getHttpServer()).post('/dashboard/ai/provider-config/test').send({ provider: 'OPENAI', model: 'gpt-4o-mini', candidateApiKey: 'candidate-key' }).expect(200);
  });

  it('forbids users without Setting permission', async () => {
    permissions = [{ action: 'read', subject: 'Booking' }];
    await request(app.getHttpServer()).get('/dashboard/ai/provider-config').expect(403);
    await request(app.getHttpServer()).get('/dashboard/ai/provider-config/models').expect(403);
    await request(app.getHttpServer()).put('/dashboard/ai/provider-config').send({ provider: 'OPENAI', model: 'gpt-4o-mini' }).expect(403);
    await request(app.getHttpServer()).post('/dashboard/ai/provider-config/test').send({ provider: 'OPENAI', model: 'gpt-4o-mini', candidateApiKey: 'candidate-key' }).expect(403);
  });

  it('enforces read/manage permissions for every knowledge-base verb', async () => {
    const id = '00000000-0000-4000-a000-000000000001';
    permissions = [{ action: 'read', subject: 'Setting' }];
    await request(app.getHttpServer()).get('/dashboard/ai/knowledge-base').expect(200);
    await request(app.getHttpServer()).get(`/dashboard/ai/knowledge-base/${id}`).expect(200);
    await request(app.getHttpServer()).post('/dashboard/ai/knowledge-base').send({ title: 'FAQ', sourceType: 'manual', content: 'hello' }).expect(403);
    await request(app.getHttpServer()).patch(`/dashboard/ai/knowledge-base/${id}`).send({ title: 'FAQ' }).expect(403);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/publish`).expect(403);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/unpublish`).expect(403);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/reindex`).expect(403);
    await request(app.getHttpServer()).delete(`/dashboard/ai/knowledge-base/${id}`).expect(403);
    permissions = [{ action: 'manage', subject: 'Setting' }];
    await request(app.getHttpServer()).post('/dashboard/ai/knowledge-base').send({ title: 'FAQ', sourceType: 'manual', content: 'hello' }).expect(201);
    await request(app.getHttpServer()).patch(`/dashboard/ai/knowledge-base/${id}`).send({ title: 'FAQ' }).expect(200);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/publish`).expect(200);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/unpublish`).expect(200);
    await request(app.getHttpServer()).post(`/dashboard/ai/knowledge-base/${id}/reindex`).expect(200);
    await request(app.getHttpServer()).delete(`/dashboard/ai/knowledge-base/${id}`).expect(204);
  });
});
