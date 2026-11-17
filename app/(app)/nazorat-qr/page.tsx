import AttendanceQrPage from "@/components/nazorat/AttendanceQrPage";
import StaffAttendanceV2 from "@/components/v2/nazorat/StaffAttendanceV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → «Ishga keldim» (yo'l nomi tarixiy). YANGI VERSIYA (17.11.2026, 34-qism): «Xodimlar davomati» —
// Bugun / Belgilash usuli / Kirish-chiqish (components/v2/nazorat/StaffAttendanceV2.tsx); `?classic=1` — eski.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <StaffAttendanceV2 />;
  return <AttendanceQrPage />;
}
