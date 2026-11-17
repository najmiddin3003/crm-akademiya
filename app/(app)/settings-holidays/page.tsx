import HolidaysV2 from "@/components/v2/settings/HolidaysV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";

// Sozlamalar → Ish kunlari va bayramlar (17.11.2026, 37-qism) — yangi sahifa, ikkala rejimda ham shu
// (components/v2/settings/HolidaysV2.tsx).
export default function Page() {
  return (
    <SettingsFrameV2>
      <HolidaysV2 />
    </SettingsFrameV2>
  );
}
