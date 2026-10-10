import { ProgramFormPage } from '@/components/features/programs/program-form-page';
import { PermissionGuard } from '@/components/features/permission-guard';

export default function NewProgramPage() {
  return (
    <PermissionGuard module="booking" action="manage">
      <ProgramFormPage mode="create" />
    </PermissionGuard>
  );
}
