import SyncPage from "@/components/finance/SyncPage";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import SyncV2 from "@/components/v2/settings/SyncV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Moliya → Sinxronizatsiya. YANGI VERSIYA (18.11.2026, 39-qism): «Google Sheets va Telegram» sozlamalar ramkasida
// (components/v2/settings/SyncV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2")
    return (
      <SettingsFrameV2 current="/settings-integrations">
        <SyncV2 />
      </SettingsFrameV2>
    );
  return <SyncPage />;
}
