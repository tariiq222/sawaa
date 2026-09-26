import 'reflect-metadata';
import { CHECK_PERMISSIONS_KEY } from '../../common/guards/casl.guard';
import { IS_PUBLIC_KEY } from '../../common/guards/jwt.guard';
import { PublicMobileHomeCardsController } from '../public/mobile-home-cards.controller';
import { DashboardMobileHomeCardsController } from './mobile-home-cards.controller';

describe('DashboardMobileHomeCardsController permissions', () => {
  it('requires read Setting permission only for listing', () => {
    const permissions = Reflect.getMetadata(CHECK_PERMISSIONS_KEY, DashboardMobileHomeCardsController.prototype.listEndpoint);
    expect(permissions).toEqual([{ action: 'read', subject: 'Setting' }]);
  });

  it('requires update Setting permission for every mutation', () => {
    for (const method of ['createEndpoint', 'updateEndpoint', 'reorderEndpoint']) {
      const permissions = Reflect.getMetadata(CHECK_PERMISSIONS_KEY, (DashboardMobileHomeCardsController.prototype as any)[method]);
      expect(permissions).toEqual([{ action: 'update', subject: 'Setting' }]);
    }
  });
});

describe('PublicMobileHomeCardsController authentication', () => {
  it('marks the public cards endpoint unauthenticated', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicMobileHomeCardsController.prototype.listEndpoint)).toBe(true);
  });
});
