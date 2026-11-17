import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import StudentAppV2 from "@/components/v2/settings/StudentAppV2";

// Sozlamalar → Ilovalar → O'quvchi ilovasi (17.11.2026, 38-qism) — components/v2/settings/StudentAppV2.tsx.
export default function Page() {
  return (
    <SettingsFrameV2>
      <StudentAppV2 />
    </SettingsFrameV2>
  );
}
