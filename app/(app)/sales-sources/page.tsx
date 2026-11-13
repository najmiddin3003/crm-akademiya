import StudentSourcesPage from "@/components/sales/StudentSourcesPage";
import SourcesV2 from "@/components/v2/settings/SourcesV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — «Sozlamalar → Lidlar → Manbalar»
// (24-qism, 13.11.2026: har manba bo'yicha lid → o'quvchi, Faol/Nofaol, Pullik belgisi).
// Eski versiyada — Sotuv va marketing → O'quvchilar oqimi o'zgarmadi. `?view=old` —
// yangi versiyadan eski diagrammaga (sahifa pastidagi havola).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view } = await searchParams;
  if ((await currentUiVersion()) === "v2" && view !== "old") {
    return (
      <SettingsFrameV2 current="/sales-sources">
        <SourcesV2 />
      </SettingsFrameV2>
    );
  }
  return <StudentSourcesPage />;
}
