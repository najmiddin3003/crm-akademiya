import { redirect } from "next/navigation";
import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — tayyor «Ilovalar» sahifalariga yo'naltiriladi
// (55-qism, 20.11.2026): «AI yordamchi» → MohirAI, «O'quvchi super ilovasi» va «Kontent» → O'quvchi ilovasi,
// qolgani («Xodim super ilovasi») → Xodim ilovasi. Eski tablardagi app.content / app.teacher / app.student
// sozlamalarini hech qaysi kod o'qimaydi (eski sahifaning o'zi «ilova ulanmagan» deydi) — yangi sahifalarda
// ularning o'rnida ishlaydigan sozlamalar bor. Eski versiyada — avvalgi tabli sahifa o'zgarmadi.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  if ((await currentUiVersion()) === "v2") {
    const { tab } = await searchParams;
    redirect(tab === "ai" ? "/settings-mohirai" : tab === "student" || tab === "content" ? "/settings-student-app" : "/settings-staff-app");
  }
  return <SettingsSectionPage sectionKey="app-settings" />;
}
