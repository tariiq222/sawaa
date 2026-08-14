import { MODULE_METADATA } from '@nestjs/common/constants';
import type { ForwardReference } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { NestContainer } from '@nestjs/core/injector/container';
import { NoopGraphInspector } from '@nestjs/core/inspector/noop-graph-inspector';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { DependenciesScanner } from '@nestjs/core/scanner';
import { Test } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import { AiInfraModule } from '../../infrastructure/ai';
import { DashboardConversationsController } from '../../api/dashboard/conversations.controller';
import { CommsModule } from './comms.module';
import { PeopleModule } from '../people/people.module';
import { IdentityModule } from '../identity/identity.module';
import { OnAdministrativeMessageProcessingRequestedHandler } from './chat/assistant/on-administrative-message-processing-requested.handler';
import { OnChatOperationsResumeRequestedHandler } from './chat/operations/on-chat-operations-resume-requested.handler';

function resolveForwardRef(value: unknown): unknown {
  return value && typeof value === 'object' && 'forwardRef' in value
    ? (value as ForwardReference).forwardRef()
    : value;
}

describe('CommsModule runtime import graph', () => {
  it('loads all three modules without a circular-import ReferenceError', () => {
    expect(CommsModule).toBeDefined();
    expect(PeopleModule).toBeDefined();
    expect(IdentityModule).toBeDefined();

    const commsImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, CommsModule) as unknown[];
    const identityImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, IdentityModule) as unknown[];

    expect(commsImports.map(resolveForwardRef)).toContain(PeopleModule);
    expect(identityImports.map(resolveForwardRef)).toContain(CommsModule);
  });

  it('registers the unified dashboard controller and its event consumers once', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CommsModule) as unknown[];
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CommsModule) as unknown[];

    expect(controllers.filter((controller) => controller === DashboardConversationsController)).toHaveLength(1);
    expect(providers.filter((provider) => provider === OnAdministrativeMessageProcessingRequestedHandler)).toHaveLength(1);
    expect(providers.filter((provider) => provider === OnChatOperationsResumeRequestedHandler)).toHaveLength(1);
  });

  it('scans and compiles the complete CommsModule dependency graph', async () => {
    const applicationConfig = new ApplicationConfig();
    const container = new NestContainer(applicationConfig);
    const scanner = new DependenciesScanner(
      container,
      new MetadataScanner(),
      NoopGraphInspector,
      applicationConfig,
    );

    await expect(scanner.scan(CommsModule)).resolves.toBeUndefined();
    expect([...container.getModules().values()].map((module) => module.metatype)).toContain(CommsModule);
  });

  it('compiles a Nest testing module that imports CommsModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-bytes',
            JWT_CLIENT_ACCESS_SECRET: 'test-client-secret-with-at-least-32-bytes',
            CHAT_GUEST_TOKEN_SECRET: 'test-guest-secret-with-at-least-32-bytes',
            CHAT_MAX_MESSAGE_LENGTH: 4_000,
            REDIS_HOST: '127.0.0.1',
            REDIS_PORT: 6379,
            MINIO_ENDPOINT: '127.0.0.1',
            MINIO_PORT: 9000,
            MINIO_ACCESS_KEY: 'test-access-key',
            MINIO_SECRET_KEY: 'test-secret-key',
            MINIO_BUCKET: 'test-bucket',
            MOYASAR_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            INTEGRATION_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            ZOOM_PROVIDER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            WHATSAPP_PROVIDER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            EMAIL_PROVIDER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            SMS_PROVIDER_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          })],
        }),
        ClsModule.forRoot({ global: true }),
        AiInfraModule,
        CommsModule,
      ],
    }).compile();

    expect(moduleRef.get(CommsModule)).toBeInstanceOf(CommsModule);
    await moduleRef.close();
  });
});
