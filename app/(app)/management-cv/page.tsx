import CvPage from "@/components/management/CvPage";
import CvListV2 from "@/components/v2/cv/CvListV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Boshqaruv → Ishga qabul (CV).
//
// YANGI VERSIYA (25.10.2026, 13-qism): nomzodlar ro'yxati, nomzod paneli, suhbat / rad etish /
// ishga olish oynalari (components/v2/cv/CvListV2.tsx); `?classic=1` — eski sahifa (Google Sheets
// sozlamasi, eski anketa modali shu yerda qoldi).
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <CvListV2 />;
  return <CvPage />;
}
