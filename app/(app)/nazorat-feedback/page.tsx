import NazoratFeedbackPage from "@/components/nazorat/NazoratFeedbackPage";
import FeedbackV2 from "@/components/v2/nazorat/FeedbackV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Fikr-mulohaza. YANGI VERSIYA (17.11.2026, 34-qism): holat, mas'ul va natija bilan
// (components/v2/nazorat/FeedbackV2.tsx); `?classic=1` — eski sahifa.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <FeedbackV2 />;
  return <NazoratFeedbackPage />;
}
