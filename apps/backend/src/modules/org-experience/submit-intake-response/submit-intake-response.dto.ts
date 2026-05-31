import { IsObject, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitIntakeResponseDto {
  @ApiProperty({ description: 'The intake form being answered', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() formId!: string;

  @ApiProperty({
    description: 'Answers keyed by field ID. Values are a string (TEXT/TEXTAREA/NUMBER/DATE/SELECT/RADIO) or string[] (CHECKBOX).',
    example: { '11111111-1111-1111-1111-111111111111': 'نعم', '22222222-2222-2222-2222-222222222222': ['خيار أ', 'خيار ب'] },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject() answers!: Record<string, string | string[]>;
}
