export class AdministrativeToolContext {
  constructor(
    readonly conversationId: string,
    readonly clientId: string | null,
    readonly sourceMessageId: string | null = null,
    readonly stateVersion: number | null = null,
    readonly leaseOwner: string | null = null,
  ) {}
}
