import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CreateGuestConversationHandler } from '../../modules/comms/chat/guest/create-conversation.handler';
import { GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { ListChatMessagesHandler } from '../../modules/comms/chat/messages/list-chat-messages.handler';
import { SendChatMessageHandler } from '../../modules/comms/chat/messages/send-chat-message.handler';
import { RequestHandoffHandler } from '../../modules/comms/chat/staff/request-handoff.handler';
import { RetryAdministrativeMessageHandler } from '../../modules/comms/chat/assistant/retry-administrative-message.handler';
import { PublicChatController } from './public-chat.controller';
import { WebChatAvailabilityService, WebChatEnabledGuard } from '../../modules/comms/chat/web-chat-availability.service';

describe('PublicChatController (e2e)', () => {
  let app: INestApplication;
  const create = { execute: jest.fn() };
  const current = { execute: jest.fn() };
  const send = { execute: jest.fn() };
  const list = { execute: jest.fn() };
  const handoff = { execute: jest.fn() };
  const retry = { execute: jest.fn() };
  let webChatEnabled = true;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicChatController],
      providers: [
        { provide: CreateGuestConversationHandler, useValue: create },
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: SendChatMessageHandler, useValue: send },
        { provide: ListChatMessagesHandler, useValue: list },
        { provide: RequestHandoffHandler, useValue: handoff },
        { provide: RetryAdministrativeMessageHandler, useValue: retry },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'WEB_CHAT_ENABLED' ? webChatEnabled : undefined } },
        WebChatAvailabilityService,
        WebChatEnabledGuard,
        { provide: GuestChatTokenService, useValue: { setCookieOptions: jest.fn().mockReturnValue({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/v1/public', maxAge: 30 * 24 * 60 * 60 * 1000 }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  afterEach(() => {
    webChatEnabled = true;
    jest.clearAllMocks();
  });

  it('returns 404 without invoking chat handlers when WEB_CHAT_ENABLED is false', async () => {
    webChatEnabled = false;

    await request(app.getHttpServer())
      .post('/public/chat/conversations')
      .send({ guestName: 'Guest A' })
      .expect(404);

    expect(create.execute).not.toHaveBeenCalled();
  });

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
    const response = await request(app.getHttpServer())
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
      ipAddress: expect.any(String),
      body: 'مرحبا',
      clientMessageId: '00000000-0000-4000-a000-000000000002',
    });
  });

  it('retries only an existing guest-owned inbound message using the guest cookie', async () => {
    retry.execute.mockResolvedValue({
      id: 'assistant-message-1', conversationId: '00000000-0000-4000-a000-000000000001',
      senderType: 'AI', kind: 'TEXT', body: 'تمت الإجابة', clientMessageId: null,
      createdAt: new Date('2026-08-13T09:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages/00000000-0000-4000-a000-000000000002/retry')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({})
      .expect(200);
    expect(response.body).toEqual(expect.objectContaining({ id: 'assistant-message-1', senderType: 'AI' }));

    expect(retry.execute).toHaveBeenCalledWith({
      audience: 'guest',
      conversationId: '00000000-0000-4000-a000-000000000001',
      messageId: '00000000-0000-4000-a000-000000000002',
      guestToken: 'guest-a',
    });

    retry.execute.mockClear();
    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/messages/00000000-0000-4000-a000-000000000002/retry')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ providerError: 'forged' })
      .expect(400);
    expect(retry.execute).not.toHaveBeenCalled();
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

  it('requests reception only with owned guest access and validated contact fields', async () => {
    handoff.execute.mockResolvedValue({
      id: '00000000-0000-4000-a000-000000000001', clientId: null, employeeId: null,
      isAiChat: true, status: 'WAITING_FOR_STAFF', language: 'ar', createdAt: '2026-08-13', updatedAt: '2026-08-13',
    });

    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/handoff')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ guestName: 'سارة' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/handoff')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ guestName: 'سارة', guestPhone: '+966501234567', reason: 'medical', riskTag: 'high' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/public/chat/conversations/00000000-0000-4000-a000-000000000001/handoff')
      .set('Cookie', 'sawaa_chat_guest=guest-a')
      .send({ guestName: '  سارة  ', guestPhone: '0501234567' })
      .expect(201);

    expect(handoff.execute).toHaveBeenCalledWith({
      audience: 'guest',
      conversationId: '00000000-0000-4000-a000-000000000001',
      guestToken: 'guest-a',
      guestName: 'سارة',
      guestPhone: '+966501234567',
    });
  });
});
