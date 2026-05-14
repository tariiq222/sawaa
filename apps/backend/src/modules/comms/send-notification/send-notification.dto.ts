import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type RecipientType = 'CLIENT' | 'EMPLOYEE';
export type NotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_REMINDER'
  | 'WELCOME'
  | 'GENERAL';

const RECIPIENT_TYPES: RecipientType[] = ['CLIENT', 'EMPLOYEE'];
const NOTIFICATION_TYPES: NotificationType[] = [
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'PAYMENT_COMPLETED',
  'PAYMENT_REMINDER',
  'WELCOME',
  'GENERAL',
];

export class SendNotificationDto {
  @ApiProperty({ description: 'UUID of the notification recipient', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() recipientId!: string;

  @ApiProperty({ description: 'Type of recipient', example: 'CLIENT', enum: RECIPIENT_TYPES, enumName: 'RecipientType' })
  @IsIn(RECIPIENT_TYPES) recipientType!: RecipientType;

  @ApiProperty({ description: 'Notification event type', example: 'BOOKING_CONFIRMED', enum: NOTIFICATION_TYPES, enumName: 'NotificationType' })
  @IsIn(NOTIFICATION_TYPES) type!: NotificationType;

  @ApiProperty({ description: 'Notification title', example: 'Booking Confirmed' })
  @IsString() @MinLength(1) title!: string;

  @ApiProperty({ description: 'Notification body text', example: 'Your appointment is confirmed for tomorrow at 10 AM.' })
  @IsString() @MinLength(1) body!: string;

  @ApiPropertyOptional({ description: 'Arbitrary metadata attached to the notification', example: { bookingId: '00000000-0000-0000-0000-000000000000' } })
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'Delivery channels to use',
    example: ['push', 'in-app'],
    enum: ['push', 'email', 'sms', 'in-app'],
    isArray: true,
    enumName: 'NotificationChannel',
  })
  @IsArray() @ArrayNotEmpty() @IsIn(['push', 'email', 'sms', 'in-app'], { each: true })
  channels!: Array<'push' | 'email' | 'sms' | 'in-app'>;

  @ApiPropertyOptional({ description: 'FCM device token for push delivery (single-token, legacy)', example: 'fXm3...token' })
  @IsOptional() @IsString() fcmToken?: string;

  @ApiPropertyOptional({ description: 'FCM device tokens for multi-device push delivery', example: ['fXm3...token-1', 'fXm3...token-2'] })
  @IsOptional() @IsArray() @IsString({ each: true }) fcmTokens?: string[];

  @ApiPropertyOptional({ description: 'Recipient email address for email delivery', example: 'user@example.com' })
  @IsOptional() @IsEmail() recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Email template slug to use for email delivery', example: 'booking-confirmed' })
  @IsOptional() @IsString() emailTemplateSlug?: string;

  @ApiPropertyOptional({ description: 'Template variable values for email rendering', example: { name: 'Fatima' } })
  @IsOptional() @IsObject() emailVars?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Recipient phone number for SMS delivery', example: '+966501234567' })
  @IsOptional() @IsString() recipientPhone?: string;
}
