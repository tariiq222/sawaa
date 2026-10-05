import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NativePaymentCapabilities,
  NativePaymentConfiguration,
} from '@sawaa/shared/types';
import { PrismaService } from '../../../../infrastructure/database';
import { PAYMENT_CONFIG_SINGLETON_KEY } from '../../../../common/constants';

@Injectable()
export class GetNativePaymentConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async read() {
    const [row, settings] = await Promise.all([
      this.prisma.organizationPaymentConfig.findUnique({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        select: { publishableKey: true, isLive: true },
      }),
      this.prisma.organizationSettings.findFirst({
        select: { paymentMoyasarEnabled: true },
      }),
    ]);
    const publishableKey = row?.publishableKey?.trim() ?? '';
    const isLive = row?.isLive === true;
    const enabled =
      settings?.paymentMoyasarEnabled === true &&
      new RegExp(`^pk_${isLive ? 'live' : 'test'}_[A-Za-z0-9]+$`).test(
        publishableKey,
      );
    const merchantId =
      this.config.get<string>('MOYASAR_APPLE_PAY_MERCHANT_ID')?.trim() ?? '';
    const label =
      this.config.get<string>('MOYASAR_APPLE_PAY_MERCHANT_LABEL')?.trim() ?? '';
    const applePay =
      enabled &&
      String(this.config.get('MOYASAR_APPLE_PAY_ENABLED')) === 'true' &&
      /^merchant\.[A-Za-z0-9.-]+$/.test(merchantId) &&
      label
        ? { merchantId, label, countryCode: 'SA' as const }
        : null;
    const capabilities: NativePaymentCapabilities = {
      enabled,
      isLive,
      supportedNetworks: ['mada', 'visa', 'mastercard'],
      applePay,
    };
    return { capabilities, publishableKey };
  }
  async execute(): Promise<NativePaymentCapabilities> {
    return (await this.read()).capabilities;
  }
  async getPaymentConfiguration(): Promise<
    Omit<
      NativePaymentConfiguration,
      'givenId' | 'amount' | 'currency' | 'description'
    >
  > {
    const { capabilities, publishableKey } = await this.read();
    if (!capabilities.enabled)
      throw new BadRequestException(
        'Online payment is not enabled or configured',
      );
    return { ...capabilities, publishableKey };
  }
}
