import EquipmentListPage from "@/components/groups/EquipmentListPage";
import EquipmentV2 from "@/components/v2/groups/EquipmentV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Jihozlar» (31-qism, 16.11.2026): ko'rsatkichlar, xonalar bo'yicha, holat va
// kafolat, mas'ul. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <EquipmentV2 />;
  return <EquipmentListPage />;
}
