import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import PayrollSettingsV2 from "@/components/v2/settings/PayrollSettingsV2";

// Sozlamalar → Moliya → Oylik va soliq (17.11.2026, 39-qism) — components/v2/settings/PayrollSettingsV2.tsx.
export default function Page() {
  return (
    <SettingsFrameV2>
      <PayrollSettingsV2 />
    </SettingsFrameV2>
  );
}
