import RolesPage from "@/components/management/RolesPage";
import RolesPageV2 from "@/components/v2/roles/RolesPageV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Boshqaruv → Rollar va huquqlar» (25-qism, 13.11.2026): huquqlar jadvali
// (rol × bo'lim), xodimga alohida ruxsat paneli va «Login hisoblari» tabi. Eski ko'rinish —
// `?classic=1` (yangi sahifadagi ⋯ menyusidan). Eski versiyada — o'zgarmagan.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <RolesPageV2 />;
  return <RolesPage />;
}
