import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClaimConversationHandler } from '../../modules/comms/chat/guest/claim-conversation.handler';
import { GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { ListChatMessagesHandler } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import { SendChatMessageHandler } from '../../modules/comms/chat/messages/send-chat-message.handler';
import { RequestHandoffHandler } from '../../modules/comms/chat/staff/request-handoff.handler';
import { MyChatController } from './my-chat.controller';
import { AcknowledgeExistingBookingHandler } from '../../modules/comms/chat/operations/acknowledge-existing-booking.handler';
import { ConfirmOperationHandler } from '../../modules/comms/chat/operations/confirm-operation.handler';
import { DeclineOperationHandler } from '../../modules/comms/chat/operations/decline-operation.handler';
import { ResumeChatOperationsHandler } from '../../modules/comms/chat/operations/resume-chat-operations.handler';
import { RetryAdministrativeMessageHandler } from '../../modules/comms/chat/assistant/retry-administrative-message.handler';
import { ListClientChatConversationsHandler } from '../../modules/comms/chat/messages/list-client-chat-conversations.handler';

describe('MyChatController (e2e)', () => {
  let app: INestApplication;
  const current = { execute: jest.fn() };
  const claim = { execute: jest.fn() };
  const send = { execute: jest.fn() };
  const list = { execute: jest.fn() };
  const listConversations = { execute: jest.fn() };
  const handoff = { execute: jest.fn() };
  const acknowledge = { execute: jest.fn() };
  const confirm = { execute: jest.fn() };
  const decline = { execute: jest.fn() };
  const resume = { execute: jest.fn().mockResolvedValue([]) };
  const retry = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MyChatController],
      providers: [
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: ClaimConversationHandler, useValue: claim },
        { provide: SendChatMessageHandler, useValue: send },
        { provide: ListChatMessagesHandler, useValue: list },
        { provide: ListClientChatConversationsHandler, useValue: listConversations },
        { provide: RequestHandoffHandler, useValue: handoff },
        { provide: AcknowledgeExistingBookingHandler, useValue: acknowledge },
        { provide: ConfirmOperationHandler, useValue: confirm },
        { provide: DeclineOperationHandler, useValue: decline },
        { provide: ResumeChatOperationsHandler, useValue: resume },
        { provide: RetryAdministrativeMessageHandler, useValue: retry },
        { provide: GuestChatTokenService, useValue: { clearCookieOptions: jest.fn().mockReturnValue({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/v1/public' }) } },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { id: 'client-a' };
        return true;
      } })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  afterEach(() => jest.clearAllMocks());

  it('loads a claimed current conversation using ClientSessionGuard identity', async () => {
    current.execute.mockResolvedValue({ id: 'conv-1', clientId: 'client-a' });

    const response = await request(app.getHttpServer())
      .get('/public/me/chat/conversations/current')
      .expect(200)
      .expect({ id: 'conv-1', clientId: 'client-a' });

    expect(current.execute).toHaveBeenCalledWith({ clientId: 'client-a' });
  });

  it('lists only history for the ClientSessionGuard identity and rejects a forged clientId query', async () => {
    listConversations.execute.mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } });

    await request(app.getHttpServer())
      .get('/public/me/chat/conversations?clientId=client-b')
      .expect(400);

    await request(app.getHttpServer())
      .get('/public/me/chat/conversations?limit=20')
      .expect(200)
      .expect({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } });

    expect(listConversations.execute).toHaveBeenCalledWith({ clientId: 'client-a', limit: 20 });
  });

  it('refuses to claim when the guest cookie is absent even with a client session', async () => {
    await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/claim')
      .expect(401);
    expect(claim.execute).not.toHaveBeenCalled();
  });

  it('claims with the guard-derived client identity and never accepts clientId in a DTO', async () => {
    claim.execute.mockResolvedValue({ id: 'conv-1', clientId: 'client-a' });

    await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/claim')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ clientId: 'client-b' })
      .expect(400);

    const claimResponse = await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/claim')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({})
      .expect(201)
      .expect({ id: 'conv-1', clientId: 'client-a', resumedOperations: [] });

    expect(claimResponse.headers['set-cookie'][0]).toEqual(expect.stringContaining('sawaa_chat_guest=;'));
    expect(claimResponse.headers['set-cookie'][0]).toEqual(expect.stringContaining('Path=/api/v1/public'));
    expect(claimResponse.headers['set-cookie'][0]).toEqual(expect.stringContaining('SameSite=Lax'));
    expect(claimResponse.headers['set-cookie'][0]).toEqual(expect.stringContaining('Expires=Thu, 01 Jan 1970'));
    expect(claimResponse.headers['set-cookie'][0]).not.toEqual(expect.stringContaining('Max-Age=2592000'));

    expect(claim.execute).toHaveBeenCalledWith({
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
      guestToken: 'guest-a',
    });
    expect(resume.execute).toHaveBeenCalledWith({
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
    });
  });

  it('keeps a successful identity claim when operation resume has a transient failure', async () => {
    claim.execute.mockResolvedValue({ id: 'conv-1', clientId: 'client-a' });
    resume.execute.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/claim')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({})
      .expect(201)
      .expect({ id: 'conv-1', clientId: 'client-a', resumedOperations: [] });
  });

  it('sends and lists client messages using ClientSessionGuard identity rather than body identity', async () => {
    send.execute.mockResolvedValue({ id: 'message-1', senderType: 'CLIENT', senderId: 'client-a', body: 'مرحبا' });
    list.execute.mockResolvedValue({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } });

    await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .send({ body: 'مرحبا', clientMessageId: '00000000-0000-4000-a000-000000000002', clientId: 'client-b' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .send({ body: 'مرحبا', clientMessageId: '00000000-0000-4000-a000-000000000002' })
      .expect(201)
      .expect({ id: 'message-1', senderType: 'CLIENT', body: 'مرحبا' });
    await request(app.getHttpServer())
      .get('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/messages?limit=20')
      .expect(200)
      .expect({ data: [], meta: { limit: 20, hasMore: false, nextCursor: null } });

    expect(send.execute).toHaveBeenCalledWith({
      audience: 'client',
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
      body: 'مرحبا',
      clientMessageId: '00000000-0000-4000-a000-000000000002',
    });
    expect(list.execute).toHaveBeenCalledWith({
      audience: 'client',
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
      limit: 20,
    });
  });

  it('retries only an existing message from the guard-owned client conversation', async () => {
    retry.execute.mockResolvedValue({
      id: 'assistant-message-1', conversationId: '00000000-0000-4000-a000-000000000001',
      senderType: 'AI', kind: 'TEXT', body: 'Done', clientMessageId: null,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/messages/00000000-0000-4000-a000-000000000002/retry')
      .send({})
      .expect(200);
    expect(response.body).toEqual(expect.objectContaining({ id: 'assistant-message-1', senderType: 'AI' }));

    expect(retry.execute).toHaveBeenCalledWith({
      audience: 'client',
      conversationId: '00000000-0000-4000-a000-000000000001',
      messageId: '00000000-0000-4000-a000-000000000002',
      clientId: 'client-a',
    });
  });

  it('requests reception from ClientSessionGuard identity and accepts no body identity or reason fields', async () => {
    handoff.execute.mockResolvedValue({ id: 'conv-1', clientId: 'client-a' });
    const url = '/public/me/chat/conversations/00000000-0000-4000-a000-000000000001/handoff';

    await request(app.getHttpServer()).post(url).send({ clientId: 'client-b' }).expect(400);
    await request(app.getHttpServer()).post(url).send({ guestName: 'سارة', guestPhone: '+966501234567' }).expect(400);
    await request(app.getHttpServer()).post(url).send({ reason: 'medical', riskTag: 'high' }).expect(400);
    await request(app.getHttpServer()).post(url).send({}).expect(201);

    expect(handoff.execute).toHaveBeenCalledWith({
      audience: 'client',
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
    });
  });

  it.each([
    ['acknowledge', acknowledge],
    ['confirm', confirm],
    ['decline', decline],
  ])('accepts only operationId plus expectedVersion for %s', async (action, operationHandler) => {
    const operationId = '00000000-0000-4000-a000-000000000010';
    operationHandler.execute.mockResolvedValue({
      id: operationId,
      type: 'CREATE_BOOKING',
      status: action === 'confirm' ? 'SUCCEEDED' : action === 'decline' ? 'DECLINED' : 'AWAITING_CONFIRMATION',
      version: 1,
      requiredConfirmations: 1,
      confirmationCount: action === 'confirm' ? 1 : 0,
      expiresAt: new Date('2026-08-13T09:15:00.000Z'),
      bookingId: action === 'confirm' ? 'booking-1' : null,
      errorCode: null,
      summary: { action: 'CREATE_BOOKING' },
    });
    const url = `/public/me/chat/operations/${operationId}/${action}`;

    await request(app.getHttpServer()).post(url).send({
      expectedVersion: 0,
      branchId: 'forged',
    }).expect(400);
    await request(app.getHttpServer()).post(url).send({ expectedVersion: 0 }).expect(200);

    expect(operationHandler.execute).toHaveBeenCalledWith({
      operationId,
      clientId: 'client-a',
      expectedVersion: 0,
    });
    const response = await request(app.getHttpServer()).post(url).send({ expectedVersion: 0 }).expect(200);
    expect(response.body).not.toHaveProperty('payload');
    expect(response.body).not.toHaveProperty('clientId');
  });
});
