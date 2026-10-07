import { Transform } from 'class-transformer';
import { ClientLoginDto } from '../client-auth/client-login.dto';

/** Mobile login shares the client password and Saudi-phone validation rules. */
export class MobilePasswordLoginDto extends ClientLoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  declare email?: string;
}
