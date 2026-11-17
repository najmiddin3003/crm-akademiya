import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import IntegrationsV2 from "@/components/v2/settings/IntegrationsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Sozlamalar → Integratsiyalar. YANGI VERSIYA (17.11.2026, 32-qism): tashqi tizimlarning haqiqiy holati va
// biriktirilmagan to'lovlar (components/v2/settings/IntegrationsV2.tsx); `?classic=1` — eski ro'yxat.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2")
    return (
      <SettingsFrameV2 current="/settings-integrations">
        <div className="p-4 sm:p-6 lg:px-8">
          <IntegrationsV2 />
        </div>
      </SettingsFrameV2>
    );
  return <SettingsSectionPage sectionKey="integration" />;
}
