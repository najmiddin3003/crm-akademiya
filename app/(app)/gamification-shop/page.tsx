import ShopPage from "@/components/gamification/shop/ShopPage";
import ShopV2 from "@/components/v2/gamification/ShopV2";
import { currentUiVersion } from "@/lib/uiVersionServer";

// Gamifikatsiya → Do'kon (TZ 5.5). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): ustoz faqat katalogni
// ko'radi, berish/qaytarish va ombor — admin va direktor (serverda).
//
// YANGI VERSIYA (24.10.2026, 11-qism): So'rovlar (tasdiqlash / rad etish / topshirildi) va
// Sovg'alar (components/v2/gamification/ShopV2.tsx, `?tab=sorovlar|sovgalar`); `?classic=1` —
// eski sahifa (byudjet, chegirmalar, istaklar).
export default async function GamificationShopRoute({ searchParams }: { searchParams: Promise<{ classic?: string; tab?: string }> }) {
  const { classic, tab } = await searchParams;
  if (classic !== "1" && (await currentUiVersion()) === "v2") return <ShopV2 initialTab={tab} />;
  return <ShopPage />;
}
