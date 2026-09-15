import type { Metadata } from "next";
import TapTestPage from "@/components/tezlik/TapTestPage";

// Ommaviy "Tezlik sinovi" — mijoz o'z qurilmasidan serverning javob
// tezligini jonli ko'radi (barmoq sinovi). 12.09.2026 da, VPS'ga ko'chgan
// kuni ochilgan; 15.09 gacha eski Vercel nusxasi bilan poyga ham bor edi
// (components/tezlik/TapTest.tsx izohi). `(app)` guruhidan tashqarida —
// sidebar/navbar yo'q, login talab qilmaydi (proxy.ts PUBLIC_PATHS).
// Mantiq: components/tezlik/TapTestPage.tsx.

export const metadata: Metadata = {
  title: "Tezlik sinovi — Tizimli",
};

export default function Page() {
  return <TapTestPage />;
}
