import { Module } from '@nestjs/common';
import { identityHandlers } from './identity.handlers';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { JwtStrategy } from './jwt.strategy';
import { ClientJwtStrategy } from './client-jwt.strategy';
import { PasswordService } from './shared/password.service';
import { TokenService } from './shared/token.service';
import { ClientTokenService } from './shared/client-token.service';
import { CaslAbilityFactory } from '../../common/casl/casl-ability.factory';
import { DashboardIdentityController } from '../../api/dashboard/identity.controller';
import { RequestOtpHandler } from './otp/request-otp.handler';
import { VerifyOtpHandler } from './otp/verify-otp.handler';
import { OtpSessionService } from './otp/otp-session.service';
import { OtpSessionGuard } from './otp/otp-session.guard';
import { NotificationChannelModule } from '../comms/notification-channel/notification-channel.module';
import { SendEmailQueueModule } from '../comms/send-email/send-email.module';
import { ClientAccountStoreModule } from '../people/clients/client-account.store.module';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { RegisterHandler } from './client-auth/register.handler';
import { PasswordHistoryService } from './client-auth/shared/password-history.service';
import { MailModule } from '../../infrastructure/mail';
import { StorageModule } from '../../infrastructure/storage';
import { OwnerProvisioningService } from './owner-provisioning/owner-provisioning.service';
import { AuthResponseBuilder } from './shared/auth-response.builder';
import { SystemRolesBootstrap } from './roles/system-roles.bootstrap';
import { DashboardTwoFactorChallengeService } from './dashboard-two-factor-challenge.service';
import { PlatformSettingsModule } from '../platform/settings/platform-settings.module';

@Module({
  imports: [
    DatabaseModule,
    MailModule,
    StorageModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationChannelModule,
    SendEmailQueueModule,
    ClientAccountStoreModule,
    PlatformSettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as `${number}${'s'|'m'|'h'|'d'}` },
      }),
    }),
  ],
  controllers: [DashboardIdentityController],
  providers: [
    JwtStrategy,
    ClientJwtStrategy,
    PasswordService,
    PasswordHistoryService,
    TokenService,
    ClientTokenService,
    RedisService,
    CaslAbilityFactory,
    ClientSessionGuard,
    ...identityHandlers,
    OtpSessionService,
    OtpSessionGuard,
    OwnerProvisioningService,
    AuthResponseBuilder,
    SystemRolesBootstrap,
    DashboardTwoFactorChallengeService,
  ],
  exports: [
    CaslAbilityFactory,
    TokenService,
    ClientTokenService,
    RedisService,
    PasswordService,
    ClientSessionGuard,
    RequestOtpHandler,
    VerifyOtpHandler,
    OtpSessionService,
    OtpSessionGuard,
    RegisterHandler,
    OwnerProvisioningService,
    AuthResponseBuilder,
    DashboardTwoFactorChallengeService,
    ...identityHandlers,
  ],
})
export class IdentityModule {}
