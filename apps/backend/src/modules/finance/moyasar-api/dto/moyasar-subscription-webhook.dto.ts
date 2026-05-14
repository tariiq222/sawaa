import { IsObject, IsString } from 'class-validator';

export class MoyasarSubscriptionWebhookDto {
  @IsString() type!: string; // 'payment_paid' | 'payment_failed'
  @IsObject() data!: {
    id: string;
    status: string;
    source?: { message?: string };
  };
}
