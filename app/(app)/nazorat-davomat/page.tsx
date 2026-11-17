import NazoratDavomatPage from "@/components/nazorat/NazoratDavomatPage";
import AttendanceControlV2 from "@/components/v2/nazorat/AttendanceControlV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Davomat. YANGI VERSIYA (17.11.2026, 34-qism): «Davomat nazorati» — Bugun / Yozuvlar /
// Belgilanmagan darslar (components/v2/nazorat/AttendanceControlV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <AttendanceControlV2 />;
  return <NazoratDavomatPage />;
}
