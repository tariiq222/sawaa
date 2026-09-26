import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../infrastructure/database';
import { PAYMENT_CONFIG_SINGLETON_KEY } from '../../../../../common/constants';

/**
 * Client-facing payment capability for the public website / mobile.
 *
 * `moyasarEnabled` is deliberately an *effective* capability, not a verbatim
 * copy of `OrganizationSettings.paymentMoyasarEnabled`. The online option is
 * advertised only when a checkout could actually complete: the toggle is not
 * explicitly disabled AND Moyasar credentials are configured. Without the
 * credentials condition the website offered online payment for an org whose
 * gateway was never configured, `payments/init` failed, and the booking sat in
 * AWAITING_PAYMENT with no way for the client to pay it.
 *
 * `atClinicEnabled` mirrors the `!paymentAtClinicEnabled` guard in
 * `create-booking.handler.ts` so a client-facing surface never offers a
 * collection path the backend would reject.
 */
export interface PublicPaymentMethodsResult {
  /** Online card checkout (Moyasar) can complete for this deployment. */
  moyasarEnabled: boolean;
  /** Clients may confirm now and pay at the center. */
  atClinicEnabled: boolean;
}

@Injectable()
export class GetPublicPaymentMethodsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicPaymentMethodsResult> {
    const [settings, paymentConfig] = await Promise.all([
      // Newest row, exactly as the dashboard reads/writes it — a client-facing
      // flag must never disagree with the toggle the admin just edited.
      this.prisma.organizationSettings.findFirst({
        select: { paymentMoyasarEnabled: true, paymentAtClinicEnabled: true },
        orderBy: { createdAt: 'desc' },
      }),
      // OrgPaymentConfig is a DB-enforced singleton, so a keyed findUnique
      // deterministically returns the one row.
      this.prisma.organizationPaymentConfig.findUnique({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        select: { id: true },
      }),
    ]);

    return {
      // `create-booking` and `init-client-payment` reject only an explicit
      // `=== false`; a configured gateway is required on top of that.
      moyasarEnabled:
        settings?.paymentMoyasarEnabled !== false && paymentConfig !== null,
      atClinicEnabled: settings?.paymentAtClinicEnabled === true,
    };
  }
}
