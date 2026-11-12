import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiConsumes,
  ApiBody,
  ApiNotFoundResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import {
  ClientResponseDto,
  EmployeeResponseDto,
  PaginatedClientsDto,
  PaginatedEmployeesDto,
  EmployeeStatsResponseDto,
  SetClientActiveResponseDto,
  UploadAvatarResponseDto,
} from './dto/people-response.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ListEmployeeRatingsHandler } from '../../modules/people/employees/list-employee-ratings.handler';
import { UploadAvatarHandler } from '../../modules/people/employees/upload-avatar/upload-avatar.handler';
import { GetEmployeeAccountHandler } from '../../modules/identity/employee-account/get-employee-account.handler';
import { CreateEmployeeAccountHandler } from '../../modules/identity/employee-account/create-employee-account.handler';
import { UpdateEmployeeAccountHandler } from '../../modules/identity/employee-account/update-employee-account.handler';
import { CreateEmployeeAccountDto } from '../../modules/identity/employee-account/create-employee-account.dto';
import { UpdateEmployeeAccountDto } from '../../modules/identity/employee-account/update-employee-account.dto';
import { PaginationDto } from '../../common/dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / People')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  ClientResponseDto, EmployeeResponseDto,
  PaginatedClientsDto, PaginatedEmployeesDto,
  EmployeeStatsResponseDto, SetClientActiveResponseDto,
  UploadAvatarResponseDto,
)
@Controller('dashboard/people')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardPeopleController')
export class DashboardPeopleEmployeeAccountController {
  constructor(
    private readonly listEmployeeRatings: ListEmployeeRatingsHandler,
    private readonly uploadAvatar: UploadAvatarHandler,
    private readonly getEmployeeAccount: GetEmployeeAccountHandler,
    private readonly createEmployeeAccount: CreateEmployeeAccountHandler,
    private readonly updateEmployeeAccount: UpdateEmployeeAccountHandler,
  ) {}

  @Get('employees/:id/ratings')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "List ratings for an employee" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page', example: 20 })
  @ApiOkResponse({
    description: 'Paginated list of employee ratings',
    schema: {
      type: 'object',
      properties: {
        starCounts: { type: 'object', additionalProperties: { type: 'integer' }, description: 'Score counts across every rating for this employee' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              employeeId: { type: 'string', format: 'uuid' },
              score: { type: 'number', minimum: 1, maximum: 5, example: 5 },
              comment: { type: 'string', nullable: true },
              isPublic: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listEmployeeRatingsEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.listEmployeeRatings.execute({ employeeId: id, ...query });
  }

  @Post('employees/:employeeId/avatar')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an avatar image for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Avatar image (JPEG/PNG/WebP), up to 5 MiB' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadAvatarResponseDto, description: 'Avatar uploaded — returns fileId and URL' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  uploadAvatarEndpoint(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadAvatar.execute({
      employeeId,
      filename: file.originalname, mimetype: file.mimetype, size: file.size,
    }, file.buffer);
  }

  @Post('employees/:employeeId/public-image')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a public profile image for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Public profile image (JPEG/PNG/WebP), up to 5 MiB' },
      },
    },
  })
  @ApiCreatedResponse({ type: UploadAvatarResponseDto, description: 'Public image uploaded — returns fileId and signed URL' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  uploadPublicImageEndpoint(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadAvatar.execute({
      employeeId, target: 'public',
      filename: file.originalname, mimetype: file.mimetype, size: file.size,
    }, file.buffer);
  }

  @Get('employees/:id/account')
  @CheckPermissions({ action: 'read', subject: 'User' })
  @ApiOperation({ summary: 'Get the login account linked to an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Employee account status',
    schema: {
      type: 'object',
      properties: {
        hasAccount: { type: 'boolean', example: true },
        employeeEmail: { type: 'string', nullable: true, example: 'practitioner@example.com' },
        account: {
          nullable: true,
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', example: 'practitioner@example.com' },
            role: { type: 'string', example: 'RECEPTIONIST' },
            isActive: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getEmployeeAccountEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getEmployeeAccount.execute({ employeeId: id });
  }

  @Post('employees/:id/account')
  @CheckPermissions({ action: 'manage', subject: 'User' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or link a login account for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiBody({ type: CreateEmployeeAccountDto })
  @ApiOkResponse({
    description: 'Linked or created user account',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', example: 'practitioner@example.com' },
        role: { type: 'string', example: 'RECEPTIONIST' },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  createEmployeeAccountEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeAccountDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new ForbiddenException('Missing actor');
    return this.createEmployeeAccount.execute({ employeeId: id, ...body, actorUserId });
  }

  @Patch('employees/:id/account')
  @CheckPermissions({ action: 'manage', subject: 'User' })
  @ApiOperation({ summary: 'Update an employee login account role or status' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiBody({ type: UpdateEmployeeAccountDto })
  @ApiOkResponse({
    description: 'Updated user account',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', example: 'practitioner@example.com' },
        role: { type: 'string', example: 'ADMIN' },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found or has no linked account' })
  updateEmployeeAccountEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmployeeAccountDto,
    @Request() req: { user?: { id?: string } },
  ) {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new ForbiddenException('Missing actor');
    return this.updateEmployeeAccount.execute({ employeeId: id, ...body, actorUserId });
  }
}
