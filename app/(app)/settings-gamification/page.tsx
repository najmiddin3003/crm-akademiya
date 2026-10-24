import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import CoinRulesV2 from "@/components/v2/settings/CoinRulesV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// YANGI VERSIYA (24.10.2026, 11-qism): «Sozlamalar → Gamifikatsiya → Tanga qoidalari»
// (`?tab=reasons` yoki tabsiz) — yangi sozlamalar ramkasida (components/v2/settings/
// CoinRulesV2.tsx). Qolgan tablar (`general`, `gifts`, `branches`) — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if ((!tab || tab === "reasons") && (await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/settings-gamification?tab=reasons">
        <CoinRulesV2 />
      </SettingsFrameV2>
    );
  }
  return <SettingsSectionPage sectionKey="gamification" />;
}
