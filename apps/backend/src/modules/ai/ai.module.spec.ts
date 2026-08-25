import { AiModule } from './ai.module';
import { KnowledgeIndexingWorker } from './knowledge-indexing/knowledge-indexing.worker';

describe('AiModule', () => {
  it('registers the knowledge consumer once even if module init repeats', () => {
    const eventBus = { subscribe: jest.fn() };
    const worker = new KnowledgeIndexingWorker(
      { knowledgeDocument: {} } as never,
      { withTransaction: jest.fn() } as never,
      { isAvailable: jest.fn() } as never,
      eventBus as never,
    );
    const module = new AiModule(worker);
    module.onModuleInit();
    module.onModuleInit();
    expect(eventBus.subscribe).toHaveBeenCalledTimes(1);
  });
});
