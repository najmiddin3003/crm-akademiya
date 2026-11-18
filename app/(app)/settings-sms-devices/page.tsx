import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import SmsDevicesV2 from "@/components/v2/settings/SmsDevicesV2";

// Sozlamalar → Integratsiyalar → SMS qurilmalar (18.11.2026, 40-qism) — components/v2/settings/SmsDevicesV2.tsx.
export default function Page() {
  return (
    <SettingsFrameV2 current="/settings-integrations">
      <SmsDevicesV2 />
    </SettingsFrameV2>
  );
}
