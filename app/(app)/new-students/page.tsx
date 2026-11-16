import NewStudentsPage from "@/components/students/NewStudentsPage";
import NewStudentsV2 from "@/components/v2/students/lists/NewStudentsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «O'quvchilar → Yangi o'quvchilar» (30-qism, 16.11.2026): guruhga qo'shilgan,
// birinchi oy to'lovi hali to'liq emas. Eski ko'rinish (Yangi holatidagi lidlar) — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <NewStudentsV2 />;
  return <NewStudentsPage />;
}
