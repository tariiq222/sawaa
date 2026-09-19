import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class NativeSessionDto {
  @ApiProperty({
    description: 'Native refresh token. It is sent in the JSON body, never as a cookie.',
    example: 'a1b2c3d4-0000-1111-2222-333344445555',
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 256)
  refreshToken!: string;
}
