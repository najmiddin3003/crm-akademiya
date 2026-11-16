import WorkSchedulesPage from "@/components/management/WorkSchedulesPage";
import WorkSchedulesV2 from "@/components/v2/employees/WorkSchedulesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Ish jadvallari» (31-qism, 16.11.2026): vaqt, tanaffus, ish kunlari, tur, biriktirilgan
// xodimlar va haftalik chiziq. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <WorkSchedulesV2 />;
  return <WorkSchedulesPage />;
}
