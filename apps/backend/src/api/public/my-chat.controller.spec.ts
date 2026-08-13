import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClaimConversationHandler } from '../../modules/comms/chat/guest/claim-conversation.handler';
import { GuestChatTokenService } from '../../modules/comms/chat/guest/guest-chat-token.service';
import { GetCurrentConversationHandler } from '../../modules/comms/chat/guest/get-current-conversation.handler';
import { MyChatController } from './my-chat.controller';

describe('MyChatController (e2e)', () => {
  let app: INestApplication;
  const current = { execute: jest.fn() };
  const claim = { execute: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MyChatController],
      providers: [
        { provide: GetCurrentConversationHandler, useValue: current },
        { provide: ClaimConversationHandler, useValue: claim },
        { provide: GuestChatTokenService, useValue: { cookieOptions: jest.fn().mockReturnValue({ httpOnly: true, sameSite: 'lax', secure: false, path: '/api/v1/public' }) } },
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

    expect(claim.execute).toHaveBeenCalledWith({
      conversationId: '00000000-0000-4000-a000-000000000001',
      clientId: 'client-a',
      guestToken: 'guest-a',
    });
  });
});
