import LevelForm from "@/components/offline-courses/LevelForm";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LevelForm courseId={Number(id)} />;
}
