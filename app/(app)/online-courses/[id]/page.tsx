import CourseDetail from "@/components/online-courses/CourseDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseDetail courseId={Number(id)} />;
}
