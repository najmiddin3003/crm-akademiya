import type { Metadata } from "next";
import SpeedRacePage from "@/components/tezlik/SpeedRacePage";

// Ommaviy "Tezlik poygasi" — mijozga eski (Vercel, Singapur) va yangi
// (Eskiz VPS, Toshkent) serverni o'z qurilmasidan jonli taqqoslab
// ko'rsatish (12.09.2026, VPS'ga ko'chgan kun). `(app)` guruhidan
// tashqarida — sidebar/navbar yo'q, login talab qilmaydi (proxy.ts
// PUBLIC_PATHS). Mantiq: components/tezlik/SpeedRacePage.tsx.

export const metadata: Metadata = {
  title: "Tezlik poygasi — Tizimli",
};

export default function Page() {
  return <SpeedRacePage />;
}
