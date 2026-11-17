import NewsPage from "@/components/sales/NewsPage";
import NewsV2 from "@/components/v2/sales/NewsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Sotuv va marketing → Yangiliklar. YANGI VERSIYA (17.11.2026, 36-qism): «Yangiliklar va hikoyalar» — kabinet
// lentasi va 24 soatlik hikoyalar bitta sahifada (components/v2/sales/NewsV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <NewsV2 />;
  return <NewsPage />;
}
