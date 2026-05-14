import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { TenantModule } from '../../common/tenant';
import { MessagingModule } from '../../infrastructure/messaging.module';
import {
  DashboardOrganizationBranchesController,
  DashboardOrganizationDepartmentsController,
  DashboardOrganizationCategoriesController,
  DashboardOrganizationHoursController,
} from '../../api/dashboard/organization.controller';
import { CreateBranchHandler } from './branches/create-branch.handler';
import { UpdateBranchHandler } from './branches/update-branch.handler';
import { ListBranchesHandler } from './branches/list-branches.handler';
import { GetBranchHandler } from './branches/get-branch.handler';
import { DeleteBranchHandler } from './branches/delete-branch.handler';
import { ListBranchEmployeesHandler } from './branches/list-branch-employees.handler';
import { AssignEmployeeToBranchHandler } from './branches/assign-employee-to-branch.handler';
import { UnassignEmployeeFromBranchHandler } from './branches/unassign-employee-from-branch.handler';
import { GetPublicBranchesHandler } from './branches/public/get-public-branches.handler';
import { GetPublicBranchHandler } from './branches/public/get-public-branch.handler';
import { ListPublicBranchEmployeesHandler } from './branches/public/list-public-branch-employees.handler';
import { CreateDepartmentHandler } from './departments/create-department.handler';
import { UpdateDepartmentHandler } from './departments/update-department.handler';
import { ListDepartmentsHandler } from './departments/list-departments.handler';
import { DeleteDepartmentHandler } from './departments/delete-department.handler';
import { CreateCategoryHandler } from './categories/create-category.handler';
import { UpdateCategoryHandler } from './categories/update-category.handler';
import { ListCategoriesHandler } from './categories/list-categories.handler';
import { DeleteCategoryHandler } from './categories/delete-category.handler';
import { SetBusinessHoursHandler } from './business-hours/set-business-hours.handler';
import { GetBusinessHoursHandler } from './business-hours/get-business-hours.handler';
import { AddHolidayHandler } from './business-hours/add-holiday.handler';
import { RemoveHolidayHandler } from './business-hours/remove-holiday.handler';
import { ListHolidaysHandler } from './business-hours/list-holidays.handler';

const branchHandlers = [
  CreateBranchHandler, UpdateBranchHandler, ListBranchesHandler, GetBranchHandler,
  DeleteBranchHandler, ListBranchEmployeesHandler,
  AssignEmployeeToBranchHandler, UnassignEmployeeFromBranchHandler,
  GetPublicBranchesHandler, GetPublicBranchHandler, ListPublicBranchEmployeesHandler,
];

const departmentHandlers = [
  CreateDepartmentHandler, UpdateDepartmentHandler, ListDepartmentsHandler,
  DeleteDepartmentHandler,
];

const categoryHandlers = [
  CreateCategoryHandler, UpdateCategoryHandler, ListCategoriesHandler,
  DeleteCategoryHandler,
];

const hoursHandlers = [
  SetBusinessHoursHandler, GetBusinessHoursHandler,
  AddHolidayHandler, RemoveHolidayHandler, ListHolidaysHandler,
];

@Module({
  imports: [DatabaseModule, TenantModule, MessagingModule],
  controllers: [
    DashboardOrganizationBranchesController,
    DashboardOrganizationDepartmentsController,
    DashboardOrganizationCategoriesController,
    DashboardOrganizationHoursController,
  ],
  providers: [
    ...branchHandlers, ...departmentHandlers, ...categoryHandlers, ...hoursHandlers,
  ],
  exports: [
    ...branchHandlers, ...departmentHandlers, ...categoryHandlers, ...hoursHandlers,
  ],
})
export class OrgConfigModule {}
