import ShopPage from "@/components/gamification/shop/ShopPage";

// Gamifikatsiya → Do'kon (TZ 5.5). Hamma xodimga ochiq
// (lib/permissions.ts → ALWAYS_ALLOWED_PATHS): ustoz faqat katalogni
// ko'radi, berish/qaytarish va ombor — admin va direktor (serverda).
export default function GamificationShopRoute() {
  return <ShopPage />;
}
