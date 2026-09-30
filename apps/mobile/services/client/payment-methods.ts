import api from '../api';

/**
 * Client-facing payment capability for this deployment.
 *
 * Mirrors the website's reader of `GET /public/payments/methods`: the backend
 * only advertises a method it can actually complete, so the app must never
 * offer one it would reject at booking time.
 */
export interface PublicPaymentMethods {
  /** Online card checkout (Moyasar) can complete for this deployment. */
  moyasarEnabled: boolean;
  /** Clients may confirm now and pay at the center. */
  atClinicEnabled: boolean;
}

export const publicPaymentMethodsService = {
  async get(): Promise<PublicPaymentMethods> {
    const response = await api.get<unknown>('/public/payments/methods');
    const payload = response.data as { moyasarEnabled?: unknown; atClinicEnabled?: unknown } | null;
    // Strict `=== true`: an unreadable payload must not resurface as an offered
    // method the backend would reject.
    return {
      moyasarEnabled: payload?.moyasarEnabled === true,
      atClinicEnabled: payload?.atClinicEnabled === true,
    };
  },
};
