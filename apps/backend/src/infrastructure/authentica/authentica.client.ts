import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../http';

type AuthenticaChannel = 'EMAIL' | 'SMS';

export interface AuthenticaSendOtpInput {
  channel: AuthenticaChannel;
  identifier: string;
  code: string;
  templateId?: number;
}

export class AuthenticaError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AuthenticaError';
  }
}

@Injectable()
export class AuthenticaClient {
  private readonly logger = new Logger(AuthenticaClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultTemplateId: number;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('AUTHENTICA_API_KEY');
    this.baseUrl = config.get<string>('AUTHENTICA_BASE_URL') ?? 'https://api.authentica.sa';
    this.defaultTemplateId = Number(config.get<string>('AUTHENTICA_DEFAULT_TEMPLATE_ID') ?? '1');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async sendOtp(input: AuthenticaSendOtpInput): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`Authentica unconfigured — skipping ${input.channel} OTP delivery`);
      return;
    }

    const body: Record<string, unknown> = {
      method: input.channel.toLowerCase(),
      template_id: input.templateId ?? this.defaultTemplateId,
      otp: input.code,
    };
    if (input.channel === 'EMAIL') {
      body.email = input.identifier;
    } else {
      body.phone = input.identifier;
    }

    await this.request('POST', '/api/v2/send-otp', body);
  }

  async getBalance(): Promise<number> {
    if (!this.apiKey) return 0;
    const data = await this.request<{ data: { balance: number } }>('GET', '/api/v2/balance');
    return data.data?.balance ?? 0;
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'X-Authorization': this.apiKey ?? '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const res = await fetchWithTimeout(url, init, 10000);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const message =
        (json as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ??
        res.statusText ??
        'Authentica request failed';
      throw new AuthenticaError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
