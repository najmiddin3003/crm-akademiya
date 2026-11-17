import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import SubscriptionV2 from "@/components/v2/settings/SubscriptionV2";

// Sozlamalar → Obuna va to'lov (17.11.2026, 37-qism) — yangi sahifa (components/v2/settings/SubscriptionV2.tsx).
export default function Page() {
  return (
    <SettingsFrameV2>
      <SubscriptionV2 />
    </SettingsFrameV2>
  );
}
