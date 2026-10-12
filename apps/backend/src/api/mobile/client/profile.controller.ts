import { Controller, Delete, Get, Patch, Body } from '@nestjs/common';
import { ClientThrottle } from '../../../common/throttle/client-throttle';
import {
  ApiTags, ApiOperation, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { ClientProfileDto } from '../../../modules/identity/client-auth/client-profile.dto';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../../modules/identity/client-auth/get-me.handler';
import { UpdateClientProfileDto } from '../../../modules/identity/client-auth/update-client-profile.dto';
import { UpdateClientProfileHandler } from '../../../modules/identity/client-auth/update-client-profile.handler';
import { ClientRoute } from '../../../common/auth/client-route.decorator';
import { RequestAccountDeletionHandler } from '../../../modules/identity/request-account-deletion/request-account-deletion.handler';

/** Same strict validators as PATCH /public/me; the class exists to keep the Swagger schema name. */
export class MobileUpdateProfileBody extends UpdateClientProfileDto {}

@ApiTags('Mobile Client / Profile')
@ApiStandardResponses()
@ClientRoute()
@Controller('mobile/client/profile')
export class MobileClientProfileController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly updateClientProfile: UpdateClientProfileHandler,
    private readonly requestAccountDeletion: RequestAccountDeletionHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated client's profile" })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Client profile record' })
  async getProfile(@ClientSession() user: ClientSession) {
    return this.getMe.execute(user.id);
  }

  @ClientThrottle('write')
  @Patch()
  @ApiOperation({ summary: "Update the authenticated client's profile" })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Updated client profile' })
  async updateProfile(
    @ClientSession() user: ClientSession,
    @Body() body: MobileUpdateProfileBody,
  ) {
    return this.updateClientProfile.execute(user.id, body);
  }

  @ClientThrottle('write')
  @Delete()
  @ApiOperation({ summary: "Close the authenticated client's login immediately" })
  @ApiOkResponse({
    description: 'Login closed; clinical and financial records retained',
    schema: {
      type: 'object', required: ['status', 'retained'],
      properties: {
        status: { type: 'string', enum: ['closed'] },
        retained: { type: 'array', items: { type: 'string', enum: ['clinical_records', 'financial_records'] } },
      },
    },
  })
  deleteProfile(@ClientSession() user: ClientSession) {
    return this.requestAccountDeletion.execute({ clientId: user.id });
  }
}
