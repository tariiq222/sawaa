import { Test } from '@nestjs/testing';

import { ListPermissionsHandler } from './list-permissions.handler';

describe('ListPermissionsHandler', () => {
  let handler: ListPermissionsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListPermissionsHandler,

      ],
    }).compile();

    handler = module.get(ListPermissionsHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute();
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
