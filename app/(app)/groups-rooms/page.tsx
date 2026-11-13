import RoomsListPage from "@/components/groups/RoomsListPage";
import RoomsV2 from "@/components/v2/settings/RoomsV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — «Sozlamalar → Umumiy → Xonalar»
// (23-qism, 13.11.2026: filial chiplari, sig'im ogohlantirishi, haftalik bandlik).
// Eski versiyada — Guruh → Xonalar ro'yxati o'zgarmadi. Versiya serverda tanlanadi.
export default async function Page() {
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/groups-rooms">
        <RoomsV2 />
      </SettingsFrameV2>
    );
  }
  return <RoomsListPage />;
}
