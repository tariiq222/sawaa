import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { GetWhatsappConfigHandler } from '../../modules/integrations/whatsapp/get-whatsapp-config.handler';
import { UpsertWhatsappConfigHandler } from '../../modules/integrations/whatsapp/upsert-whatsapp-config.handler';
import { TestWhatsappConfigHandler } from '../../modules/integrations/whatsapp/test-whatsapp-config.handler';
import { ResetWhatsappConfigHandler } from '../../modules/integrations/whatsapp/reset-whatsapp-config.handler';
import { UpsertWhatsappConfigDto } from '../../modules/integrations/whatsapp/dto/upsert-whatsapp-config.dto';

@ApiTags('Dashboard / WhatsApp Integration')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/integrations/whatsapp')
@UseGuards(JwtGuard, CaslGuard)
export class WhatsappIntegrationsController {
  constructor(
    private readonly getConfig: GetWhatsappConfigHandler,
    private readonly upsertConfig: UpsertWhatsappConfigHandler,
    private readonly testConfig: TestWhatsappConfigHandler,
    private readonly resetConfig: ResetWhatsappConfigHandler,
  ) {}

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Integration' })
  @ApiOperation({ summary: 'Get WhatsApp integration status (no secrets returned)' })
  get() {
    return this.getConfig.execute();
  }

  @Put()
  @CheckPermissions({ action: 'manage', subject: 'Integration' })
  @ApiOperation({ summary: 'Create or update WhatsApp Cloud API credentials' })
  upsert(@Body() body: UpsertWhatsappConfigDto) {
    return this.upsertConfig.execute(body);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Integration' })
  @ApiOperation({ summary: 'Verify Evolution API credentials by fetching connection state' })
  @ApiOkResponse({
    description: 'WhatsApp credential test result',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        phoneNumber: { type: 'string', nullable: true },
        error: { type: 'string', nullable: true },
      },
    },
  })
  test() {
    return this.testConfig.execute();
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Integration' })
  @ApiOperation({ summary: 'Erase WhatsApp credentials and disconnect the agent' })
  reset() {
    return this.resetConfig.execute();
  }
}
