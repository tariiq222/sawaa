import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import {
  CLIENT_READ_SCHEMA, ClientReadResponseDto, ClientResponseDto, CreateClientResponseDto,
  EmployeeScopedClientResponseDto, EmployeeResponseDto,
  PaginatedClientsDto, PaginatedEmployeesDto,
  EmployeeStatsResponseDto, SetClientActiveResponseDto,
  UploadAvatarResponseDto,
} from './dto/people-response.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { DeleteClientHandler } from '../../modules/people/clients/delete-client.handler';
import { SetClientActiveHandler } from '../../modules/people/clients/set-client-active/set-client-active.handler';
import { SetClientActiveDto } from '../../modules/people/clients/set-client-active/set-client-active.dto';
import { CreateClientDto } from '../../modules/people/clients/create-client.dto';
import { UpdateClientDto } from '../../modules/people/clients/update-client.dto';
import { ListClientsDto } from '../../modules/people/clients/list-clients.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / People')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  ClientResponseDto, EmployeeScopedClientResponseDto, EmployeeResponseDto,
  PaginatedClientsDto, PaginatedEmployeesDto,
  EmployeeStatsResponseDto, SetClientActiveResponseDto,
  UploadAvatarResponseDto,
)
@Controller('dashboard/people')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardPeopleController')
export class DashboardPeopleClientsController {
  constructor(
    private readonly createClient: CreateClientHandler,
    private readonly updateClient: UpdateClientHandler,
    private readonly listClients: ListClientsHandler,
    private readonly getClient: GetClientHandler,
    private readonly deleteClient: DeleteClientHandler,
    private readonly setClientActive: SetClientActiveHandler,
  ) {}

  @Post('clients')
  @CheckPermissions({ action: 'create', subject: 'Client' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a client' })
  @ApiCreatedResponse({ type: CreateClientResponseDto, description: 'Client created or matched by phone' })
  createClientEndpoint(@Body() body: CreateClientDto): Promise<CreateClientResponseDto> {
    return this.createClient.execute(body);
  }

  @Get('clients')
  @CheckPermissions({ action: 'read', subject: 'Client' })
  @ApiOperation({ summary: 'List clients' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or phone', example: 'Sara' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status', example: true })
  @ApiQuery({ name: 'gender', required: false, description: 'Filter by gender', example: 'FEMALE' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by acquisition source', example: 'REFERRAL' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ type: PaginatedClientsDto, description: 'Paginated list of clients' })
  listClientsEndpoint(
    @Query() query: ListClientsDto,
    @Query('isActive') rawIsActive: string | undefined,
    @Request() req: { user: { sub: string; role?: string | null } },
  ): Promise<PaginatedClientsDto> {
    // Global ValidationPipe has enableImplicitConversion: true, which runs
    // Boolean(string) against query params — making any non-empty string truthy
    // (so "false" becomes true). Parse the raw value explicitly instead.
    const isActive =
      rawIsActive === 'true' ? true : rawIsActive === 'false' ? false : undefined;
    return this.listClients.execute({
      ...query,
      isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      requesterRole: req.user.role ?? null,
      requesterUserId: req.user.sub,
    });
  }

  @Get('clients/:id')
  @CheckPermissions({ action: 'read', subject: 'Client' })
  @ApiOperation({ summary: 'Get a client by ID' })
  @ApiParam({ name: 'id', description: 'Client UUID or reference (e.g. CL-1024)', example: 'CL-1024' })
  @ApiOkResponse({ schema: CLIENT_READ_SCHEMA, description: 'Client record (shape depends on the caller role)' })
  @ApiNotFoundResponse({ description: 'Client not found' })
  getClientEndpoint(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; role?: string | null } },
  ): Promise<ClientReadResponseDto> {
    return this.getClient.execute({ clientId: id, requesterRole: req.user.role ?? null, requesterUserId: req.user.sub });
  }

  @Patch('clients/:id')
  @CheckPermissions({ action: 'update', subject: 'Client' })
  @ApiOperation({ summary: 'Update a client' })
  @ApiParam({ name: 'id', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: ClientResponseDto, description: 'Updated client record' })
  @ApiNotFoundResponse({ description: 'Client not found' })
  updateClientEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return this.updateClient.execute({ clientId: id, ...body });
  }

  @Delete('clients/:id')
  @CheckPermissions({ action: 'delete', subject: 'Client' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a client' })
  @ApiParam({ name: 'id', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Client deleted' })
  @ApiNotFoundResponse({ description: 'Client not found' })
  async deleteClientEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteClient.execute({ clientId: id });
  }

  @Patch('clients/:id/active')
  @CheckPermissions({ action: 'update', subject: 'Client' })
  @ApiOperation({ summary: 'Enable or disable a client account' })
  @ApiParam({ name: 'id', description: 'Client UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiBody({ type: SetClientActiveDto })
  @ApiOkResponse({ type: SetClientActiveResponseDto, description: 'Client account status updated' })
  @ApiNotFoundResponse({ description: 'Client not found' })
  setClientActiveEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetClientActiveDto,
    @Request() req: { user?: { id?: string } },
  ): Promise<SetClientActiveResponseDto> {
    return this.setClientActive.execute({
      clientId: id,
      isActive: body.isActive,
      reason: body.reason,
      actorUserId: req.user?.id,
    });
  }
}
