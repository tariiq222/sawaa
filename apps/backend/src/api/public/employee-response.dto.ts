import { ApiProperty } from '@nestjs/swagger';
import { PublicEmployeeResponseDto } from '../dashboard/dto/people-response.dto';

/**
 * Synthetic user shape the public employee handler emits so legacy consumers
 * that read `employee.user.firstName/lastName/avatarUrl` keep rendering.
 *
 * Documentation-only; the runtime payload is produced by
 * `ListPublicEmployeesHandler` / `GetPublicEmployeeHandler`. `email` is always
 * an empty string and `phone` is always null — the public surface exposes no
 * contact data — and `avatarUrl` mirrors `publicImageUrl`.
 */
export class PublicEmployeeSyntheticUserDto {
  @ApiProperty({ description: 'Synthetic user UUID (equal to the employee UUID)', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ description: 'First token of the display name', example: 'أحمد' })
  firstName!: string;

  @ApiProperty({ description: 'Remaining tokens of the display name (empty string for a single-token name)', example: 'الغامدي' })
  lastName!: string;

  @ApiProperty({ description: 'Always an empty string on the public surface', example: '' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Always null on the public surface', example: null })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Mirror of publicImageUrl, or null', example: null })
  avatarUrl!: string | null;
}

/**
 * Public employee row: the base `PublicEmployeeResponseDto` plus the three
 * fields the handler has always emitted but the snapshot never documented
 * (`user`, `rating`, `reviewCount`).
 *
 * `rating`/`reviewCount` are the legacy names for `ratingAverage`/`ratingCount`
 * (same values, 0 instead of null when there are no public ratings).
 */
export class PublicEmployeeProfileDto extends PublicEmployeeResponseDto {
  @ApiProperty({ type: PublicEmployeeSyntheticUserDto, description: 'Synthetic user shape kept for legacy consumers' })
  user!: PublicEmployeeSyntheticUserDto;

  @ApiProperty({ description: 'Legacy alias of ratingAverage; 0 when there are no public ratings', example: 4.8 })
  rating!: number;

  @ApiProperty({ description: 'Legacy alias of ratingCount', example: 18 })
  reviewCount!: number;
}
