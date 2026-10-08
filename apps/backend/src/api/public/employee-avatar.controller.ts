import { Controller, Get, Header, Param, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { PublicEmployeeAvatarHandler } from '../../modules/people/employees/self-profile/public-employee-avatar.handler';

@ApiTags('Public / Employees')
@ApiPublicResponses()
@Controller('public/employees/images')
export class PublicEmployeeAvatarController {
  constructor(private readonly avatar: PublicEmployeeAvatarHandler) {}
  @Public()
  @Get(':fileId')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Read the current explicitly public employee profile photo' })
  @ApiParam({ name: 'fileId', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async get(@Param('fileId', ParseUUIDPipe) fileId: string) {
    const result = await this.avatar.execute(fileId);
    return new StreamableFile(result.stream, { type: result.mimetype, length: result.size, disposition: 'inline' });
  }
}
