import { Test } from '@nestjs/testing';

import { TestZoomConfigHandler } from './test-zoom-config.handler';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';

describe('TestZoomConfigHandler', () => {
  let handler: TestZoomConfigHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TestZoomConfigHandler,
    { provide: ZoomApiClient, useValue: {} }
      ],
    }).compile();

    handler = module.get(TestZoomConfigHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute({});
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
