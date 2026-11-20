import NazoratDavomatAnalyticsPage from "@/components/nazorat/NazoratDavomatAnalyticsPage";
import NazoratDavomatAnalyticsV2 from "@/components/v2/nazorat/NazoratDavomatAnalyticsV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Davomat analitikasi. Yangi versiyada (28-qism, 20.11.2026) — holatlar kataklari, kunma-kun
// grafik/jadval va o'sha CSV (components/v2/nazorat/NazoratDavomatAnalyticsV2.tsx); eski versiya o'zgarmadi.
// Versiya serverda tanlanadi — miltillashsiz.
export default async function Page() {
  return (await currentUiVersion()) === "v2" ? <NazoratDavomatAnalyticsV2 /> : <NazoratDavomatAnalyticsPage />;
}
