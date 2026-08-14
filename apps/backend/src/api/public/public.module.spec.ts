import { MODULE_METADATA } from '@nestjs/common/constants';
import { MyChatController } from './my-chat.controller';
import { PublicChatController } from './public-chat.controller';
import { PublicModule } from './public.module';

describe('PublicModule chat registration', () => {
  it('exposes each public chat controller exactly once through the boot module', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PublicModule) as unknown[];

    expect(controllers.filter((controller) => controller === PublicChatController)).toHaveLength(1);
    expect(controllers.filter((controller) => controller === MyChatController)).toHaveLength(1);
  });
});
