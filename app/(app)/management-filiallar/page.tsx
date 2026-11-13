import BranchesPage from "@/components/management/BranchesPage";
import BranchesV2 from "@/components/v2/settings/BranchesV2";
import SettingsFrameV2 from "@/components/v2/settings/SettingsFrameV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Sozlamalar → Umumiy → Filiallar» (23-qism, 13.11.2026): ichki
// Sozlamalar menyusi, jadval va «Filial qo'shish» oynasi. Eski versiyada — Boshqaruv →
// Filiallar ro'yxati o'zgarmadi. Ikkalasi bitta /api/branches dan.
export default async function Page() {
  if ((await currentUiVersion()) === "v2") {
    return (
      <SettingsFrameV2 current="/management-filiallar">
        <BranchesV2 />
      </SettingsFrameV2>
    );
  }
  return <BranchesPage />;
}
