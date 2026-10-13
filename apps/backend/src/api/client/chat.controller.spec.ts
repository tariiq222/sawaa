import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { WebChatEnabledGuard } from '../../modules/comms/chat/web-chat-availability.service';
import { MyChatController } from '../public/my-chat.controller';
import { ClientChatController } from './chat.controller';
import { CHAT_CONTROLLERS } from './chat.controllers';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

function routes(controller: new (...args: never[]) => object) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => typeof proto[name] === 'function' && name !== 'constructor')
    .map((name) => {
      const fn = proto[name] as object;
      return `${METHODS[Reflect.getMetadata(METHOD_METADATA, fn)]} ${Reflect.getMetadata(PATH_METADATA, fn)}`;
    })
    .sort();
}

describe('ClientChatController', () => {
  const handler = () => ({ execute: jest.fn() });
  const build = <T>(Ctl: new (...args: never[]) => T) => {
    const h = Array.from({ length: 13 }, handler);
    // Constructor order: current, claim, tokens, send, list, listConversations, getConversation,
    // handoff, acknowledge, confirm, decline, resume, retry.
    h[2] = { clearCookieOptions: jest.fn() } as never;
    const ctl = new (Ctl as unknown as new (...args: unknown[]) => T)(...h);
    return { ctl, h };
  };
  const session = { id: 'client-1' };
  const uuid = '11111111-1111-4111-8111-111111111111';

  it('is registered in CHAT_CONTROLLERS under client/chat', () => {
    expect(CHAT_CONTROLLERS).toContain(ClientChatController);
    expect(Reflect.getMetadata(PATH_METADATA, ClientChatController)).toBe('client/chat');
  });

  it('exposes the same 11 routes as the legacy controller', () => {
    const expected = [
      'GET conversations',
      'GET conversations/:conversationId',
      'GET conversations/:conversationId/messages',
      'GET conversations/current',
      'POST conversations/:conversationId/claim',
      'POST conversations/:conversationId/handoff',
      'POST conversations/:conversationId/messages',
      'POST conversations/:conversationId/messages/:messageId/retry',
      'POST operations/:operationId/acknowledge',
      'POST operations/:operationId/confirm',
      'POST operations/:operationId/decline',
    ].sort();
    expect(routes(ClientChatController)).toEqual(expected);
    expect(routes(MyChatController)).toEqual(expected);
  });

  it('runs WebChatEnabledGuard before ClientSessionGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ClientChatController)).toEqual([WebChatEnabledGuard, ClientSessionGuard]);
  });

  it('forwards current/list/confirm args identically to the legacy controller', async () => {
    const a = build(ClientChatController);
    const b = build(MyChatController);
    for (const { h } of [a, b]) {
      h[0]!.execute.mockResolvedValue({ id: 'c' });
      h[4]!.execute.mockResolvedValue({ items: [] });
      h[9]!.execute.mockResolvedValue({
        id: uuid, type: 'BOOK', status: 'CONFIRMED', version: 2, requiredConfirmations: 1, confirmationCount: 1,
        expiresAt: new Date('2026-01-01T00:00:00Z'), bookingId: null, errorCode: null, summary: {},
      });
    }
    const call = async ({ ctl }: { ctl: ClientChatController | MyChatController }) => [
      await ctl.current(session),
      await ctl.listMessagesForClient(uuid, { limit: 5 } as never, session),
      await ctl.confirmPreparedOperation(uuid, { expectedVersion: 1 } as never, session),
    ];
    expect(await call(a)).toEqual(await call(b));
    for (const i of [0, 4, 9]) {
      expect(a.h[i]!.execute.mock.calls).toEqual(b.h[i]!.execute.mock.calls);
    }
  });
});
