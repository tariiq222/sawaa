import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendTestEmailDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsEmail()
  to!: string;

  @IsOptional()
  @IsObject()
  vars?: Record<string, string>;
}
