import ReferralSettingsV2 from "@/components/v2/settings/ReferralSettingsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Sozlamalar → Lidlar → Referal dasturi (29-qism). Yangi versiyada sozlamalar ramkasi ichida; eski versiyada
// shu bo'limning o'zi (eski versiyada bunday sozlama yo'q edi).
export default async function Page() {
  const body = (
    <div className="p-4 sm:p-6 lg:px-8">
      <ReferralSettingsV2 />
    </div>
  );
  if ((await currentUiVersion()) === "v2") return <SettingsFrameV2 current="/settings-referral">{body}</SettingsFrameV2>;
  return <div data-ui="v2" className="min-h-full bg-v2-surface font-v2 text-v2-text">{body}</div>;
}
