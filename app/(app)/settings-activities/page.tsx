import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import ActivitiesV2 from "@/components/v2/settings/ActivitiesV2";

// Sozlamalar → O'quv → Qo'shimcha mashg'ulotlar (18.11.2026, 41-qism) — components/v2/settings/ActivitiesV2.tsx.
export default function Page() {
  return (
    <SettingsFrameV2>
      <ActivitiesV2 />
    </SettingsFrameV2>
  );
}
