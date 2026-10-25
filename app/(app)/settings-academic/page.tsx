import SettingsSectionPage from "@/components/settings/SettingsSectionPage";
import ExamSubjectsV2 from "@/components/v2/settings/ExamSubjectsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// YANGI VERSIYA (25.10.2026, 12-qism): «Sozlamalar → O'quv → Imtihon fanlari» (`?tab=exam-subjects`) —
// UzBMB ball tuzilishi va fanlar, yangi sozlamalar ramkasida (components/v2/settings/ExamSubjectsV2.tsx).
// Qolgan tablar — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "exam-subjects" && (await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/settings-academic?tab=exam-subjects">
        <ExamSubjectsV2 />
      </SettingsFrameV2>
    );
  }
  return <SettingsSectionPage sectionKey="study" />;
}
