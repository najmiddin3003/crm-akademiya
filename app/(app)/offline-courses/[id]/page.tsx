import CourseDetail from "@/components/offline-courses/CourseDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetail id={Number(id)} />;
}
