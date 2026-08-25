import { BaseEvent } from '../../../common/events';

export const KNOWLEDGE_REINDEX_REQUESTED_EVENT = 'ai.knowledge.reindex_requested.v1';

export interface KnowledgeReindexRequestedPayload {
  documentId: string;
  contentHash: string;
}

export class KnowledgeReindexRequestedEvent extends BaseEvent<KnowledgeReindexRequestedPayload> {
  readonly eventName = KNOWLEDGE_REINDEX_REQUESTED_EVENT;

  constructor(payload: KnowledgeReindexRequestedPayload) {
    super({ source: 'ai.knowledge-base', version: 1, payload });
  }
}
