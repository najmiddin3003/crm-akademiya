import LevelForm from "@/components/offline-courses/LevelForm";

export default async function Page({ params }: { params: Promise<{ id: string; levelId: string }> }) {
  const { id, levelId } = await params;
  return <LevelForm courseId={Number(id)} levelId={Number(levelId)} />;
}
