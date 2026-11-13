import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import CenterInfoV2 from "@/components/v2/settings/CenterInfoV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Sozlamalar → Umumiy → Markaz ma'lumotlari» (23-qism, 13.11.2026):
// markaz ma'lumotlari va chek ko'rinishi. Eski «Umumiy sozlamalar» tablari
// (Funksionallik, Bayram kunlari, Ommaviy oferta …) `?tab=` bilan eski ko'rinishda
// ochiladi — yangi sahifa pastidagi havola shu yerga olib keladi.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tab } = await searchParams;
  if ((await currentUiVersion()) === "v2" && !tab) {
    return (
      <SettingsFrameV2 current="/settings-general">
        <CenterInfoV2 />
      </SettingsFrameV2>
    );
  }
  return <SettingsSectionPage sectionKey="system" />;
}
