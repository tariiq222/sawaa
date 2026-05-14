import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ClientSession {
  id: string;
  email: string | null;
  phone: string | null;
}

export const ClientSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientSession => {
    const request = ctx.switchToHttp().getRequest<{ user: ClientSession }>();
    return request.user;
  },
);
