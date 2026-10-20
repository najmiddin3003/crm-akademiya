import EmployeeProfilePage from "@/components/employees/EmployeeProfilePage";
import EmployeeProfileV2 from "@/components/v2/employees/EmployeeProfileV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada (lib/uiVersion.ts, cookie `tizimli_ui`) — yangi dizayndagi xodim profili
// (components/v2/employees/EmployeeProfileV2.tsx, 20.10.2026: guruhlar jadvali, oylik,
// topshiriqlar). Eski profilning tablari (tranzaksiyalar, to'lovlar, daftar, eslatma …)
// yangi dizaynda yo'q — `?classic=1` (`&tab=…`) bilan eski ko'rinishda ochiladi.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ classic?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if ((await currentUiVersion()) === "v2" && sp.classic !== "1") {
    return <EmployeeProfileV2 id={Number(id)} />;
  }
  return <EmployeeProfilePage id={Number(id)} initialTab={typeof sp.tab === "string" ? sp.tab : undefined} />;
}
