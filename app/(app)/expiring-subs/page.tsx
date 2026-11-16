import ExpiringSubsPage from "@/components/expiring-subs/ExpiringSubsPage";
import ExpiringSubsV2 from "@/components/v2/students/lists/ExpiringSubsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Yangi versiyada — «Joriy oyda obunasi tugaydiganlar» (30-qism, 16.11.2026): to'lov kuni oy
// oxirigacha keladiganlar, keyingi to'lov summasi va SMS eslatma. Eski ko'rinish — `?classic=1`.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { classic } = await searchParams;
  if ((await currentUiVersion()) === "v2" && classic !== "1") return <ExpiringSubsV2 />;
  return <ExpiringSubsPage />;
}
