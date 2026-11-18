import TeacherGroupsV2 from "@/components/v2/teacher/TeacherGroupsV2";

// O'qituvchi · Guruhlarim (45-qism) — o'z guruhlari, o'quvchilar va o'quvchi kartasi (faqat ko'rish).
// `?teacher=ISM` — rahbar ko'rinishi. Kim ekani serverda tekshiriladi (/api/teacher, lib/teacherDesk.ts).
export default async function Page({ searchParams }: { searchParams: Promise<{ teacher?: string }> }) {
  const { teacher } = await searchParams;
  return <TeacherGroupsV2 teacher={teacher?.trim() || undefined} />;
}
