import NazoratSmsAnalyticsPage from "@/components/nazorat/NazoratSmsAnalyticsPage";
import MessageDeliveryV2 from "@/components/v2/nazorat/MessageDeliveryV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Nazorat → Xabarlar. YANGI VERSIYA (17.11.2026, 34-qism): «Xabarlar yetkazilishi» — Telegram bot va SMS
// birga (components/v2/nazorat/MessageDeliveryV2.tsx); `?classic=1` — eski SMS analitikasi.
export default async function Page({ searchParams }: { searchParams: Promise<{ classic?: string }> }) {
  const { classic } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <MessageDeliveryV2 />;
  return <NazoratSmsAnalyticsPage />;
}
