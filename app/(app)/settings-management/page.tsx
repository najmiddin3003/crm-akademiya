import { redirect } from "next/navigation";
import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — «Lavozim va stavkalar» sahifasiga yo'naltiriladi
// (55-qism, 20.11.2026): eski «Menejer / O'qituvchilar grading tizimi» ro'yxatlari (settings-lists
// degrees-manager / degrees-teacher) o'sha yerda yangi dizaynda — components/v2/settings/PositionsV2.tsx.
// Eski versiyada — avvalgi tabli sahifa o'zgarmadi. Versiya serverda tanlanadi.
export default async function Page() {
  if ((await currentUiVersion()) === "v2") redirect("/settings-positions");
  return <SettingsSectionPage sectionKey="management" />;
}
