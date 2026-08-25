import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { AssignConversationHandler } from '../../modules/comms/chat/staff/assign-conversation.handler';
import { ClaimConversationHandler } from '../../modules/comms/chat/staff/claim-conversation.handler';
import { CloseConversationHandler } from '../../modules/comms/chat/staff/close-conversation.handler';
import { GetConversationHandler } from '../../modules/comms/chat/staff/get-conversation.handler';
import { ListConversationMessagesHandler } from '../../modules/comms/chat/staff/list-conversation-messages.handler';
import { ListInboxHandler } from '../../modules/comms/chat/staff/list-inbox.handler';
import { MarkConversationReadHandler } from '../../modules/comms/chat/staff/mark-conversation-read.handler';
import { ReleaseConversationHandler } from '../../modules/comms/chat/staff/release-conversation.handler';
import { ReplyConversationHandler } from '../../modules/comms/chat/staff/reply-conversation.handler';
import { DashboardConversationsController } from './conversations.controller';

describe('DashboardConversationsController (real CaslGuard)', () => {
  let app: INestApplication;
  const handlers = {
    list: { execute: jest.fn().mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } }) },
    get: { execute: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
    messages: { execute: jest.fn().mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } }) },
    claim: { execute: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
    markRead: { execute: jest.fn().mockResolvedValue({ markedReadCount: 1 }) },
    reply: { execute: jest.fn().mockResolvedValue({ id: 'message-1' }) },
    assign: { execute: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
    release: { execute: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
    close: { execute: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
  };

  beforeAll(async () => {
    const fakeJwt: CanActivate = {
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        const role = String(req.headers['x-test-role'] ?? 'RECEPTIONIST');
        req.user = { id: 'staff-a', sub: 'staff-a', role, roles: [role], customRole: null };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [DashboardConversationsController],
      providers: [
        { provide: ListInboxHandler, useValue: handlers.list },
        { provide: GetConversationHandler, useValue: handlers.get },
        { provide: ListConversationMessagesHandler, useValue: handlers.messages },
        { provide: ClaimConversationHandler, useValue: handlers.claim },
        { provide: MarkConversationReadHandler, useValue: handlers.markRead },
        { provide: ReplyConversationHandler, useValue: handlers.reply },
        { provide: AssignConversationHandler, useValue: handlers.assign },
        { provide: ReleaseConversationHandler, useValue: handlers.release },
        { provide: CloseConversationHandler, useValue: handlers.close },
      ],
    }).overrideGuard(JwtGuard).useValue(fakeJwt).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  afterEach(() => jest.clearAllMocks());

  it.each([
    ['SUPER_ADMIN', 200], ['ADMIN', 200], ['RECEPTIONIST', 200],
    ['OWNER', 403], ['ACCOUNTANT', 403], ['EMPLOYEE', 403], ['CLIENT', 403],
  ])('enforces the exact Conversation role matrix for %s', async (role, status) => {
    await request(app.getHttpServer()).get('/dashboard/conversations').set('x-test-role', role).expect(status);
  });

  it('derives claim/reply identities from JWT and rejects caller-supplied sender fields', async () => {
    const base = '/dashboard/conversations/00000000-0000-4000-a000-000000000001';
    await request(app.getHttpServer()).post(`${base}/claim`).set('x-test-role', 'RECEPTIONIST').expect(201);
    await request(app.getHttpServer()).post(`${base}/messages`).set('x-test-role', 'RECEPTIONIST')
      .send({ body: 'مرحبا', clientMessageId: 'staff-1', senderId: 'attacker', senderType: 'AI' }).expect(400);
    await request(app.getHttpServer()).post(`${base}/messages`).set('x-test-role', 'RECEPTIONIST')
      .send({ body: 'مرحبا', clientMessageId: 'staff-1' }).expect(201);
    expect(handlers.claim.execute).toHaveBeenCalledWith({ conversationId: '00000000-0000-4000-a000-000000000001', staffUserId: 'staff-a' });
    expect(handlers.reply.execute).toHaveBeenCalledWith({
      conversationId: '00000000-0000-4000-a000-000000000001', staffUserId: 'staff-a', body: 'مرحبا', clientMessageId: 'staff-1',
    });
  });

  it('requires manage Conversation for assignment while reception can claim self', async () => {
    const url = '/dashboard/conversations/00000000-0000-4000-a000-000000000001/assign';
    await request(app.getHttpServer()).post(url).set('x-test-role', 'RECEPTIONIST')
      .send({ targetStaffUserId: '00000000-0000-4000-a000-000000000002' }).expect(403);
    await request(app.getHttpServer()).post(url).set('x-test-role', 'ADMIN')
      .send({ targetStaffUserId: '00000000-0000-4000-a000-000000000002' }).expect(200);
    expect(handlers.assign.execute).toHaveBeenCalledWith({
      conversationId: '00000000-0000-4000-a000-000000000001',
      targetStaffUserId: '00000000-0000-4000-a000-000000000002',
      actorUserId: 'staff-a',
      actorRole: 'ADMIN',
    });
  });

  it('passes JWT role into inbox isolation', async () => {
    await request(app.getHttpServer()).get('/dashboard/conversations?assigned=all').set('x-test-role', 'RECEPTIONIST').expect(200);
    expect(handlers.list.execute).toHaveBeenCalledWith(expect.objectContaining({ staffUserId: 'staff-a', staffRole: 'RECEPTIONIST', assigned: 'all' }));
  });
});
