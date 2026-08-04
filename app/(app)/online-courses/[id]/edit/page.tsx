import CourseWizard from "@/components/online-courses/CourseWizard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseWizard courseId={Number(id)} />;
}
