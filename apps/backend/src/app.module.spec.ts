process.env.AI_PROVIDER_ENCRYPTION_KEY ??=
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

describe('AppModule', () => {
  it('should be defined', async () => {
    const { AppModule } = await import('./app.module');
    expect(AppModule).toBeDefined();
  });

  it('does not register the retired WhatsApp module while retaining core communications', async () => {
    const { AppModule } = await import('./app.module');
    const { MessagingModule } = await import('./infrastructure/messaging.module');
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    const names = imports.map((entry) => (entry as { name?: string })?.name);
    const messagingProviders = Reflect.getMetadata('providers', MessagingModule) as unknown[];

    expect(names).toContain('CommsModule');
    expect(names).not.toContain('WhatsappModule');
    expect(messagingProviders.map((entry) => (entry as { name?: string })?.name)).not.toContain(
      'WhatsappInboundQueueService',
    );
  });
});
