import GroupDetailPage from "@/components/groups/GroupDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupDetailPage id={Number(id)} />;
}
