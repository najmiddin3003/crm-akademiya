import ParentsPage from "@/components/parents/ParentsPage";
import ParentsV2 from "@/components/v2/students/lists/ParentsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Ota-ona» (30-qism, 16.11.2026): kartadagi ota-onalar farzandlari bilan,
// kabinet (o'quvchilar boti) holati va «Kabinetga taklif». Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <ParentsV2 />;
  return <ParentsPage />;
}
