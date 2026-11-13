import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import SurveySettingsV2 from "@/components/v2/settings/SurveySettingsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada `?tab=leads` — «Sozlamalar → Lidlar → So'rovnoma sahifasi» (24-qism,
// 13.11.2026: havola va QR, «Sahifa ochiq», savollar ro'yxatlari, telefon ko'rinishi).
// Boshqa tablar va `&view=old` (rad sabablari bilan to'liq eski Lidlar tabi) — eski
// «Sotuv va marketing» sozlamalari, o'zgarmadi.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tab, view } = await searchParams;
  if (tab === "leads" && view !== "old" && (await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/settings-sales?tab=leads">
        <SurveySettingsV2 />
      </SettingsFrameV2>
    );
  }
  return <SettingsSectionPage sectionKey="sale-marketing" />;
}
