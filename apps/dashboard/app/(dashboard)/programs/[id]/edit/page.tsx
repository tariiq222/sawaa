import { ProgramFormPage } from '@/components/features/programs/program-form-page';
import { PermissionGuard } from '@/components/features/permission-guard';

export default async function EditProgramRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PermissionGuard module="booking" action="update">
      <ProgramFormPage mode="edit" programId={id} />
    </PermissionGuard>
  );
}
