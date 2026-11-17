import CourseDetail from "@/components/offline-courses/CourseDetail";
import CoursePageV2 from "@/components/v2/academic/CoursePageV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Kurs sahifasi. YANGI VERSIYA (17.11.2026, 36-qism): darajalar va narx, ustozlar, dars vaqtlari, kitoblar —
// guruhlardan yig'iladi (components/v2/academic/CoursePageV2.tsx); `?classic=1` — eski kurs tafsiloti.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ classic?: string }> }) {
  const { id } = await params;
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <CoursePageV2 id={Number(id)} />;
  return <CourseDetail id={Number(id)} />;
}
