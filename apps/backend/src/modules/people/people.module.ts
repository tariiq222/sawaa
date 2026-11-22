import { GetSelfProfileHandler, UpdateSelfProfileHandler } from './employees/self-profile/self-profile.handler';
import { ChangeSelfAvatarHandler } from './employees/self-profile/self-avatar.handler';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DatabaseModule } from '../../infrastructure/database';
import { CLIENT_ACCOUNT_STORE } from '../../common/contracts/client-account.contract';
import { PgClientAccountStore } from './clients/client-account.store';
import { MediaModule } from '../media/media.module';
import { PublicEmployeeAvatarController } from '../../api/public/employee-avatar.controller';
import { PublicEmployeeAvatarHandler } from './employees/self-profile/public-employee-avatar.handler';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { UploadAvatarHandler } from './employees/upload-avatar/upload-avatar.handler';
import { CreateClientHandler } from './clients/create-client.handler';
import { UpdateClientHandler } from './clients/update-client.handler';
import { ListClientsHandler } from './clients/list-clients.handler';
import { GetClientHandler } from './clients/get-client.handler';
import { DeleteClientHandler } from './clients/delete-client.handler';
import { CreateEmployeeHandler } from './employees/create-employee.handler';
import { UpdateAvailabilityHandler } from './employees/update-availability.handler';
import { EmployeeOnboardingHandler } from './employees/employee-onboarding.handler';
import { OnboardEmployeeHandler } from './employees/onboard-employee.handler';
import { GetAvailabilityHandler } from './employees/get-availability.handler';
import { UpdateEmployeeHandler } from './employees/update-employee.handler';
import { ListEmployeesHandler } from './employees/list-employees.handler';
import { GetEmployeeHandler } from './employees/get-employee.handler';
import { DeleteEmployeeHandler } from './employees/delete-employee.handler';
import { ListEmployeeServicesHandler } from './employees/list-employee-services.handler';
import { GetEmployeeServiceTypesHandler } from './employees/get-employee-service-types.handler';
import { AssignEmployeeServiceHandler } from './employees/assign-employee-service.handler';
import { UpdateEmployeeServiceHandler } from './employees/update-employee-service.handler';
import { RemoveEmployeeServiceHandler } from './employees/remove-employee-service.handler';
import { ListEmployeeExceptionsHandler } from './employees/list-employee-exceptions.handler';
import { CreateEmployeeExceptionHandler } from './employees/create-employee-exception.handler';
import { DeleteEmployeeExceptionHandler } from './employees/delete-employee-exception.handler';
import { ListEmployeeRatingsHandler } from './employees/list-employee-ratings.handler';
import { EmployeeStatsHandler } from './employees/employee-stats.handler';
import { GetEmployeeBreaksHandler } from './employees/get-employee-breaks/get-employee-breaks.handler';
import { SetEmployeeBreaksHandler } from './employees/set-employee-breaks/set-employee-breaks.handler';
import { ListPublicEmployeesHandler } from './employees/public/list-public-employees.handler';
import { GetPublicEmployeeHandler } from './employees/public/get-public-employee.handler';
import { SetClientActiveHandler } from './clients/set-client-active/set-client-active.handler';
import { ListEmployeeClientsHandler } from './clients/list-employee-clients.handler';
import { GetEmployeeClientHistoryHandler } from './clients/get-employee-client-history.handler';
import { GetEmployeeClientHandler } from './clients/get-employee-client.handler';
import { ResolveEmployeeIdHandler } from './employees/resolve-employee-id.handler';
import { LogActivityHandler } from '../ops/log-activity/log-activity.handler';
import { DashboardPeopleClientsController } from '../../api/dashboard/people-clients.controller';
import { DashboardPeopleEmployeeScheduleController } from '../../api/dashboard/people-employee-schedule.controller';
import { DashboardPeopleEmployeeServicesController } from '../../api/dashboard/people-employee-services.controller';
import { MAX_FILE_SIZE_BYTES } from '../media/files/upload-file.handler';
import { NotificationIntentCaptureModule } from '../../common/notification-intent/notification-intent-capture.module';

import { GetPublicEmployeeImageHandler } from './employees/public/get-public-employee-image.handler';

const handlers = [
  GetSelfProfileHandler, UpdateSelfProfileHandler, ChangeSelfAvatarHandler,
  GetPublicEmployeeImageHandler,
  CreateClientHandler, UpdateClientHandler, ListClientsHandler, GetClientHandler, DeleteClientHandler,
  SetClientActiveHandler, LogActivityHandler,
  ListEmployeeClientsHandler, GetEmployeeClientHistoryHandler, GetEmployeeClientHandler, ResolveEmployeeIdHandler,
  CreateEmployeeHandler, UpdateAvailabilityHandler, EmployeeOnboardingHandler, OnboardEmployeeHandler, GetAvailabilityHandler, UpdateEmployeeHandler,
  ListEmployeesHandler, GetEmployeeHandler,
  DeleteEmployeeHandler, ListEmployeeServicesHandler, GetEmployeeServiceTypesHandler, AssignEmployeeServiceHandler,
  UpdateEmployeeServiceHandler, RemoveEmployeeServiceHandler, ListEmployeeExceptionsHandler, CreateEmployeeExceptionHandler,
  DeleteEmployeeExceptionHandler, ListEmployeeRatingsHandler, EmployeeStatsHandler,
  UploadAvatarHandler,
  ListPublicEmployeesHandler, GetPublicEmployeeHandler,
  GetEmployeeBreaksHandler, SetEmployeeBreaksHandler,
];

@Module({
  imports: [DatabaseModule, MediaModule, MessagingModule, MulterModule.register({ storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 } }), OrgExperienceModule, NotificationIntentCaptureModule],
  controllers: [
    DashboardPeopleClientsController,
    DashboardPeopleEmployeeScheduleController,
    DashboardPeopleEmployeeServicesController,
    PublicEmployeeAvatarController,
  ],
  providers: [...handlers, PublicEmployeeAvatarHandler, PgClientAccountStore, {
    provide: CLIENT_ACCOUNT_STORE,
    useExisting: PgClientAccountStore,
  }],
  exports: [...handlers, CLIENT_ACCOUNT_STORE],
})
export class PeopleModule {}
