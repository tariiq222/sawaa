import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CreateGuestConversationHandler } from '../../modules/comms/chat/guest/create-conversation.handler';
import { GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { ListChatMessagesHandler } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import { SendChatMessageHandler } from '../../modules/comms/chat/messages/send-chat-message.handler';
import { PublicChatController } from './public-chat.controller';

describe('PublicChatController (e2e)', () => {
  let app: INestApplication;
  const create = { execute: jest.fn() };
  const current = { execute: jest.fn() };
  const send = { execute: jest.fn() };
  const list = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicChatController],
      providers: [
        { provide: CreateGuestConversationHandler, useValue: create },
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: SendChatMessageHandler, useValue: send },
        { provide: ListChatMessagesHandler, useValue: list },
        { provide: GuestChatTokenService, useValue: { setCookieOptions: jest.fn().mockReturnValue({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/v1/public', maxAge: 30 * 24 * 60 * 60 * 1000 }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  afterEach(() => jest.clearAllMocks());

  it('creates a guest conversation, sets a secure cookie, and never returns its raw token or hash', async () => {
    create.execute.mockResolvedValue({
      guestToken: 'raw-guest-token',
      conversation: { id: 'conv-1', clientId: null, guestTokenHash: 'hmac', guestName: 'Guest A' },
    });

    const response = await request(app.getHttpServer())
      .post('/public/chat/conversations')
      .send({ guestName: 'Guest A' })
      .expect(201);

    expect(response.body).toEqual({ id: 'conv-1', clientId: null });
    expect(response.text).not.toContain('raw-guest-token');
    expect(response.text).not.toContain('hmac');
    expect(response.headers['set-cookie'][0]).toEqual(expect.stringContaining('sawaa_chat_guest=raw-guest-token'));
    expect(response.headers['set-cookie'][0]).toEqual(expect.stringContaining('HttpOnly'));
    expect(response.headers['set-cookie'][0]).toEqual(expect.stringContaining('SameSite=Lax'));
    expect(response.headers['set-cookie'][0]).toEqual(expect.stringContaining('Max-Age=2592000'));
  });

  it('rejects a clientId supplied at the public creation boundary', async () => {
    await request(app.getHttpServer())
      .post('/public/chat/conversations')
      .send({ clientId: 'client-a' })
      .expect(400);
    expect(create.execute).not.toHaveBeenCalled();
  });

  it('loads the current conversation only from the HttpOnly guest cookie', async () => {
    current.execute.mockResolvedValue({ id: 'conv-1', clientId: null });

    await request(app.getHttpServer())
      .get('/public/chat/conversations/current')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .expect(200)
      .expect({ id: 'conv-1', clientId: null });

    expect(current.execute).toHaveBeenCalledWith({ guestToken: 'guest-a' });
  });

  it('sends a guest message using only the guest cookie and never accepts a caller supplied sender identity', async () => {
    send.execute.mockResolvedValue({ id: 'message-1', senderType: 'VISITOR', body: 'مرحبا' });

    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ body: 'مرحبا', clientMessageId: '00000000-0000-4000-a000-000000000002', senderType: 'AI' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ body: 'مرحبا', clientMessageId: '00000000-0000-4000-a000-000000000002' })
      .expect(201)
      .expect({ id: 'message-1', senderType: 'VISITOR', body: 'مرحبا' });

    expect(send.execute).toHaveBeenCalledWith({
      audience: 'guest',
      conversationId: '00000000-0000-4000-a000-000000000001',
      guestToken: 'guest-a',
      body: 'مرحبا',
      clientMessageId: '00000000-0000-4000-a000-000000000002',
    });
  });

  it('requires the guest cookie for sending and reading conversation messages', async () => {
    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .send({ body: 'مرحبا', clientMessageId: '00000000-0000-4000-a000-000000000002' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages')
      .expect(401);
    expect(send.execute).not.toHaveBeenCalled();
    expect(list.execute).not.toHaveBeenCalled();
  });
});
