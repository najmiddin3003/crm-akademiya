import { redirect } from "next/navigation";
import "@fontsource-variable/onest/wght.css";
import { getCurrentUser } from "@/lib/auth";
import { REPORTS, canOpenReport } from "@/lib/reportsCatalog";
import ReportsCatalogV2 from "@/components/v2/reports/ReportsCatalogV2";

// HISOBOTLAR KATALOGI (yangi versiya, 15-qism — rasm «Hisobotlar katalogi», 25.10.2026).
//
// RUXSAT: "/reports" ALWAYS_ALLOWED_PATHS da (lib/permissions.ts) — sidebar daraxtida yo'q,
// shuning uchun proxy qorovuli uni yopmaydi; BU YERDA har hisobot o'z eski sahifasi ruxsati
// bilan kesiladi (lib/reportsCatalog.ts → canOpenReport). Eski versiyada bu sahifaga havola
// yo'q (yon menyuda faqat yangi versiyada) — eski dizayn nusxasi ATAYLAB qilinmadi.
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const allowed = REPORTS.filter((r) => canOpenReport(r, user.permissions)).map((r) => r.slug);
  return <ReportsCatalogV2 allowed={allowed} />;
}
