import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ClientChannel } from './client-channel';

export interface ClientSession {
  id: string;
  email: string | null;
  phone: string | null;
  channel: ClientChannel;
}

export const ClientSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientSession => {
    const request = ctx.switchToHttp().getRequest<{ user: ClientSession }>();
    return request.user;
  },
);
