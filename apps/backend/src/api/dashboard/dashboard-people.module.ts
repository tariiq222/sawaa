import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PeopleModule } from '../../modules/people/people.module';
import { MAX_FILE_SIZE_BYTES } from '../../modules/media/files/upload-file.handler';
import { DashboardPeopleEmployeesController } from './people-employees.controller';
import { DashboardPeopleEmployeeAccountController } from './people-employee-account.controller';

/**
 * Dashboard audience module for the people surface.
 *
 * The two controllers live in `src/api/dashboard/` (the right place) but were
 * registered inside `PeopleModule`, which forced `PeopleModule` to import
 * `BookingsModule` and `IdentityModule` through `forwardRef` just to satisfy
 * their constructor dependencies — and that in turn made `people` an entry
 * point into two other clusters. Registering them here keeps the wiring in the
 * API layer, where cross-cluster controllers belong, so `PeopleModule` stays a
 * leaf module.
 *
 * No route or guard changes: the controllers keep the same `@Controller`
 * prefix, guards and permission checks; only the module that owns their
 * instantiation moves.
 *
 * MulterModule MUST be imported here, not only where the controllers used to
 * live. `FileInterceptor('file')` resolves `MULTER_MODULE_OPTIONS` optionally,
 * and `MulterModule.register` exposes that token to the module that imports it
 * only. Without this, the avatar uploads would buffer an unbounded body before
 * the 5 MiB handler check could reject it.
 */
@Module({
  imports: [
    DatabaseModule,
    PeopleModule,
    IdentityModule,
    BookingsModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
    }),
  ],
  controllers: [
    DashboardPeopleEmployeesController,
    DashboardPeopleEmployeeAccountController,
  ],
})
export class DashboardPeopleModule {}
