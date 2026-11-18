import TeacherCheckV2 from "@/components/v2/teacher/TeacherCheckV2";

// O'qituvchi · Uy vazifalarini tekshirish (45-qism). `?taskId=` — ochiladigan vazifa; `?teacher=ISM` — rahbar ko'rinishi.
export default async function Page({ searchParams }: { searchParams: Promise<{ taskId?: string; teacher?: string }> }) {
  const { taskId, teacher } = await searchParams;
  return <TeacherCheckV2 taskId={Number(taskId) || undefined} teacher={teacher?.trim() || undefined} />;
}
