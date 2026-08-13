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
import { MyChatController } from './my-chat.controller';

describe('MyChatController (e2e)', () => {
  let app: INestApplication;
  const current = { execute: jest.fn() };
  const claim = { execute: jest.fn() };
  const send = { execute: jest.fn() };
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MyChatController],
      providers: [
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: ClaimConversationHandler, useValue: claim },
        { provide: SendChatMessageHandler, useValue: send },
        { provide: ListChatMessagesHandler, useValue: list },
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

    await request(app.getHttpServer())
      .get('/public/me/chat/conversations/current')
      .expect(200)
      .expect({ id: 'conv-1', clientId: 'client-a' });

    expect(current.execute).toHaveBeenCalledWith({ clientId: 'client-a' });
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
      .expect({ id: 'conv-1', clientId: 'client-a' });

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
});
