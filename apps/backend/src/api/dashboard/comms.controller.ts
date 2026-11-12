import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { GetOrgSmsConfigHandler } from '../../modules/comms/org-sms-config/get-org-sms-config.handler';
import { UpsertOrgSmsConfigHandler } from '../../modules/comms/org-sms-config/upsert-org-sms-config.handler';
import { UpsertOrgSmsConfigDto } from '../../modules/comms/org-sms-config/upsert-org-sms-config.dto';
import { TestSmsConfigHandler } from '../../modules/comms/org-sms-config/test-sms-config.handler';
import { TestSmsConfigDto } from '../../modules/comms/org-sms-config/test-sms-config.dto';
import { GetOrgEmailConfigHandler } from '../../modules/comms/org-email-config/get-org-email-config.handler';
import { UpsertOrgEmailConfigHandler } from '../../modules/comms/org-email-config/upsert-org-email-config.handler';
import { UpsertOrgEmailConfigDto } from '../../modules/comms/org-email-config/upsert-org-email-config.dto';
import { TestEmailConfigHandler } from '../../modules/comms/org-email-config/test-email-config.handler';
import { TestEmailConfigDto } from '../../modules/comms/org-email-config/test-email-config.dto';
import { ListSmsDeliveriesHandler } from '../../modules/comms/list-sms-deliveries/list-sms-deliveries.handler';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardCommsController {
  constructor(
    private readonly getOrgSmsConfig: GetOrgSmsConfigHandler,
    private readonly upsertOrgSmsConfig: UpsertOrgSmsConfigHandler,
    private readonly testSmsConfig: TestSmsConfigHandler,
    private readonly getOrgEmailConfig: GetOrgEmailConfigHandler,
    private readonly upsertOrgEmailConfig: UpsertOrgEmailConfigHandler,
    private readonly testEmailConfig: TestEmailConfigHandler,
    private readonly listSmsDeliveries: ListSmsDeliveriesHandler,
  ) {}

  @ApiOperation({ summary: 'Get SMS provider configuration (owner-scoped)' })
  @ApiOkResponse({ description: 'OrganizationSmsConfig view (no secrets)' })
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Get('settings/sms')
  getSmsConfigEndpoint() {
    return this.getOrgSmsConfig.execute();
  }

  @ApiOperation({ summary: 'Upsert SMS provider configuration' })
  @ApiOkResponse({ description: 'Updated OrganizationSmsConfig view' })
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Post('settings/sms')
  upsertSmsConfigEndpoint(@Body() dto: UpsertOrgSmsConfigDto) {
    return this.upsertOrgSmsConfig.execute(dto);
  }

  @ApiOperation({ summary: 'Send a test SMS via the configured provider' })
  @ApiOkResponse({ description: 'Test result' })
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Post('settings/sms/test')
  testSmsConfigEndpoint(@Body() dto: TestSmsConfigDto) {
    return this.testSmsConfig.execute(dto);
  }

  @ApiOperation({ summary: 'Get email provider configuration (owner-scoped)' })
  @ApiOkResponse({ description: 'OrganizationEmailConfig view (no secrets)' })
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Get('settings/email')
  getEmailConfigEndpoint() {
    return this.getOrgEmailConfig.execute();
  }

  @ApiOperation({ summary: 'Upsert email provider configuration' })
  @ApiOkResponse({ description: 'Updated OrganizationEmailConfig view' })
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Post('settings/email')
  upsertEmailConfigEndpoint(@Body() dto: UpsertOrgEmailConfigDto) {
    return this.upsertOrgEmailConfig.execute(dto);
  }

  @ApiOperation({ summary: 'Send a test email via the configured provider' })
  @ApiOkResponse({ description: 'Test result' })
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'ProviderConfig' })
  @Post('settings/email/test')
  testEmailConfigEndpoint(@Body() dto: TestEmailConfigDto) {
    return this.testEmailConfig.execute(dto);
  }

  @ApiOperation({ summary: 'List the 50 most recent SMS deliveries' })
  @ApiOkResponse({ description: 'Recent SmsDelivery rows (owner-scoped)' })
  @CheckPermissions({ action: 'read', subject: 'PersonalData' })
  @Get('settings/sms/deliveries')
  listSmsDeliveriesEndpoint() {
    return this.listSmsDeliveries.execute();
  }
}
