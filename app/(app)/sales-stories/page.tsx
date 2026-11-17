import StoriesPage from "@/components/sales/StoriesPage";
import NewsV2 from "@/components/v2/sales/NewsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Sotuv va marketing → Hikoya. YANGI VERSIYADA (36-qism) hikoyalar «Yangiliklar va hikoyalar» sahifasida
// (components/v2/sales/NewsV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <NewsV2 />;
  return <StoriesPage />;
}
