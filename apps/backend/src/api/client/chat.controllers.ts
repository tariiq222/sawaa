import type { Provider, Type } from '@nestjs/common';
import { ClientChatController } from './chat.controller';

/** Controllers for the unified /api/v1/client surface — chat area. */
export const CHAT_CONTROLLERS: Type<unknown>[] = [ClientChatController];
/** Providers that only this area needs beyond what the feature modules export. */
export const CHAT_PROVIDERS: Provider[] = [];
