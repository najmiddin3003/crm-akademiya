import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import PositionsV2 from "@/components/v2/settings/PositionsV2";

// Sozlamalar → Moliya → Lavozim va stavkalar (18.11.2026, 40-qism) — components/v2/settings/PositionsV2.tsx.
export default function Page() {
  return (
    <SettingsFrameV2>
      <PositionsV2 />
    </SettingsFrameV2>
  );
}
