import OnlineCoursesList from "@/components/online-courses/OnlineCoursesList";
import OnlineCoursesV2 from "@/components/v2/academic/OnlineCoursesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// O'quv bo'limi → Onlayn kurslar. YANGI VERSIYA (17.11.2026, 36-qism): kurslar va tuzilma (modul → video darslar,
// modul testi), o'quvchi va test statistikasi (components/v2/academic/OnlineCoursesV2.tsx); `?classic=1` — eski ro'yxat.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <OnlineCoursesV2 />;
  return <OnlineCoursesList />;
}
