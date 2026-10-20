import EmployeesListPage from "@/components/employees/EmployeesListPage";
import EmployeesListV2 from "@/components/v2/employees/EmployeesListV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi Xodimlar
// ro'yxati (components/v2/employees/EmployeesListV2.tsx, 20.10.2026). Ikkalasi bitta
// yadrodan (components/employees/useEmployeesCore.ts). Versiya serverda tanlanadi.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <EmployeesListV2 /> : <EmployeesListPage />;
}
