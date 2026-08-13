import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CreateGuestConversationHandler } from '../../modules/comms/chat/guest/create-conversation.handler';
import { GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { PublicChatController } from './public-chat.controller';

describe('PublicChatController (e2e)', () => {
  let app: INestApplication;
  const create = { execute: jest.fn() };
  const current = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicChatController],
      providers: [
        { provide: CreateGuestConversationHandler, useValue: create },
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: GuestChatTokenService, useValue: { cookieOptions: jest.fn().mockReturnValue({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/v1/public' }) } },
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
});
