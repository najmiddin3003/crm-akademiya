import GroupTasksPage from "@/components/groups/GroupTasksPage";
import GroupTasksV2 from "@/components/v2/groups/GroupTasksV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Barcha vazifalar» (31-qism, 16.11.2026): filial guruhlariga berilgan uy vazifalari
// va testlar, muddatlar, «Vazifa berish». Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <GroupTasksV2 />;
  return <GroupTasksPage />;
}
