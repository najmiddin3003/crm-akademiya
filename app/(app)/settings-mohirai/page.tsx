import AiSettingsV2 from "@/components/v2/settings/AiSettingsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";

// Sozlamalar → Ilovalar → MohirAI (17.11.2026, 38-qism) — yangi sahifa (components/v2/settings/AiSettingsV2.tsx).
// Eski versiyada sozlama «Ilova sozlamalari → AI yordamchi» tabida (components/settings/AiAssistantTab.tsx).
export default function Page() {
  return (
    <SettingsFrameV2>
      <AiSettingsV2 />
    </SettingsFrameV2>
  );
}
