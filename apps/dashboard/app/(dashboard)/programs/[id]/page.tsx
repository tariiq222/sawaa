import { ProgramDetailPage } from '@/components/features/programs/program-detail-page';

export default async function ProgramDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgramDetailPage id={id} />;
}
