import TeacherLessonV2 from "@/components/v2/teacher/TeacherLessonV2";

// O'qituvchi · Dars oynasi (45-qism) — davomat va tanga, mavzu, uy vazifasi, yakunlash. `?groupId=` — guruh;
// `?teacher=ISM` — rahbar ko'rinishi. Kim ekani serverda tekshiriladi (/api/teacher, lib/teacherDesk.ts).
export default async function Page({ searchParams }: { searchParams: Promise<{ groupId?: string; teacher?: string }> }) {
  const { groupId, teacher } = await searchParams;
  return <TeacherLessonV2 groupId={Number(groupId) || 0} teacher={teacher?.trim() || undefined} />;
}
