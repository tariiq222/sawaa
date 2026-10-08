import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { GetSelfProfileHandler, UpdateSelfProfileHandler } from '../../../modules/people/employees/self-profile/self-profile.handler';
import { SelfProfileResponseDto, UpdateSelfProfileDto } from '../../../modules/people/employees/self-profile/self-profile.dto';
import { ChangeSelfAvatarHandler, SELF_AVATAR_LIMIT } from '../../../modules/people/employees/self-profile/self-avatar.handler';
import { RequestEmployeeContactHandler } from '../../../modules/identity/employee-contact/request-employee-contact.handler';
import { VerifyEmployeeContactHandler } from '../../../modules/identity/employee-contact/verify-employee-contact.handler';
import { EmployeeContactChallengeResponseDto, RequestEmployeeContactDto, VerifyEmployeeContactDto } from '../../../modules/identity/employee-contact/employee-contact.dto';

@ApiTags('Mobile Employee / Profile')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/employee/profile')
export class MobileEmployeeProfileController {
  constructor(private readonly read: GetSelfProfileHandler, private readonly update: UpdateSelfProfileHandler,
    private readonly avatar: ChangeSelfAvatarHandler, private readonly requestContact: RequestEmployeeContactHandler,
    private readonly verifyContact: VerifyEmployeeContactHandler) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get the authenticated employee profile' })
  @ApiOkResponse({ type: SelfProfileResponseDto })
  get(@CurrentUser() user: JwtUser) { return this.read.execute(user.sub); }
  @Patch()
  @ApiOperation({ summary: 'Update the authenticated employee biography, experience and languages' })
  @ApiOkResponse({ type: SelfProfileResponseDto })
  patch(@CurrentUser() user: JwtUser, @Body() body: UpdateSelfProfileDto) { return this.update.execute(user.sub, body); }
  @Post('avatar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: SELF_AVATAR_LIMIT, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload the authenticated employee profile image' })
  @ApiOkResponse({ type: SelfProfileResponseDto })
  async upload(@CurrentUser() user: JwtUser, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.avatar.execute(user.sub, file);
    return this.read.execute(user.sub);
  }
  @Delete('avatar')
  @ApiOperation({ summary: 'Remove the authenticated employee profile image' })
  @ApiOkResponse({ type: SelfProfileResponseDto })
  async remove(@CurrentUser() user: JwtUser) { await this.avatar.execute(user.sub, null); return this.read.execute(user.sub); }
  @Post('contact/request')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Send a confirmation code to a new employee contact' })
  @ApiOkResponse({ type: EmployeeContactChallengeResponseDto })
  request(@CurrentUser() user: JwtUser, @Body() body: RequestEmployeeContactDto) { return this.requestContact.execute(user.sub, body); }
  @Post('contact/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Verify and adopt a new employee contact' })
  @ApiOkResponse({ type: SelfProfileResponseDto })
  async verify(@CurrentUser() user: JwtUser, @Body() body: VerifyEmployeeContactDto) { await this.verifyContact.execute(user.sub, body); return this.read.execute(user.sub); }
}
