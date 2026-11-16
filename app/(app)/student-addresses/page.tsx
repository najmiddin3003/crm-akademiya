import StudentAddressesPage from "@/components/student-addresses/StudentAddressesPage";
import StudentAddressesV2 from "@/components/v2/students/lists/StudentAddressesV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «O'quvchilar manzillari» (30-qism, 16.11.2026): mahallalar bo'yicha taqsimot,
// mahalla / manzil / mo'ljal / yashash turi va «Manzil qo'shish» oynasi. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <StudentAddressesV2 />;
  return <StudentAddressesPage />;
}
