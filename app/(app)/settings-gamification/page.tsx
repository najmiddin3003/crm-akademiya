import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import CoinRulesV2 from "@/components/v2/settings/CoinRulesV2";
import CoinSystemV2 from "@/components/v2/settings/CoinSystemV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// YANGI VERSIYA (Sozlamalar ramkasida, components/v2/settings/):
//   • `?tab=general` (yoki tabsiz) — «Tanga tizimi» (33-qism, CoinSystemV2.tsx);
//   • `?tab=reasons` — «Tanga sabablari» (11-qism, 33-qismda yangilandi — CoinRulesV2.tsx).
// Qolgan tablar (`gifts`, `branches` — sovg'a byudjeti) va `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; classic?: string }> }) {
  const { tab, classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") {
    if (tab === "reasons") {
      return (
        <SettingsFrameV2 current="/settings-gamification?tab=reasons">
          <CoinRulesV2 />
        </SettingsFrameV2>
      );
    }
    if (!tab || tab === "general") {
      return (
        <SettingsFrameV2 current="/settings-gamification?tab=general">
          <div className="p-4 sm:p-6 lg:px-8">
            <CoinSystemV2 />
          </div>
        </SettingsFrameV2>
      );
    }
  }
  return <SettingsSectionPage sectionKey="gamification" />;
}
