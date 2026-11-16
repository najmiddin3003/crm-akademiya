import GroupStudentsPage from "@/components/groups/GroupStudentsPage";
import GroupStudentsV2 from "@/components/v2/groups/GroupStudentsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Guruh o'quvchilari» (31-qism, 16.11.2026): guruhlar bo'yicha a'zolar, joriy oy
// davomati, bo'sh o'rinlar va «Ko'chirish». Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <GroupStudentsV2 />;
  return <GroupStudentsPage />;
}
