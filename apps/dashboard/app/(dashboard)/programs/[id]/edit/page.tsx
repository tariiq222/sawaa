import { ProgramFormPage } from '@/components/features/programs/program-form-page';

export default async function EditProgramRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgramFormPage mode="edit" programId={id} />;
}
