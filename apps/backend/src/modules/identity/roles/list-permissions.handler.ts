import { Injectable } from '@nestjs/common';
import {
  PERMISSION_SUBJECTS,
  PERMISSION_ACTIONS,
  type PermissionSubject,
  type PermissionAction,
} from '@deqah/shared/constants/permissions-catalog';

export interface PermissionDto {
  id: string;
  module: PermissionSubject;
  action: PermissionAction;
}

@Injectable()
export class ListPermissionsHandler {
  async execute(): Promise<PermissionDto[]> {
    const out: PermissionDto[] = [];
    for (const subject of PERMISSION_SUBJECTS) {
      for (const action of PERMISSION_ACTIONS) {
        out.push({
          id: `${subject}:${action}`,
          module: subject,
          action,
        });
      }
    }
    return out;
  }
}
