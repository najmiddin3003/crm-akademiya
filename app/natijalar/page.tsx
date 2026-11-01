import type { Metadata } from "next";
import { CENTER_NAME, IS_AKADEMIYA } from "@/lib/center";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPublicResults } from "@/lib/publicResults";
import type { PublicResults } from "@/lib/imtihon";
import PublicResultsPage from "@/components/imtihon/PublicResultsPage";

// OCHIQ IMTIHON NATIJALARI (01.11.2026) — Imtihon → Sarhisob natijalari
// o'quvchilar uchun. Havola Sarhisob'dagi «Ochiq havolani nusxalash»
// tugmasidan (joriy filial + tanlangan oy). Sahifa `(app)` guruhidan
// tashqarida — sidebar/navbar yo'q, KIRISH TALAB QILINMAYDI (proxy.ts →
// PUBLIC_PATHS). Qidiruv tizimlariga berilmaydi (robots).
//
// Ma'lumot SERVERDA (lib/publicResults.ts) — telefon shu yerda yashiriladi,
// brauzerga faqat oxirgi 4 raqam boradi. Oy/filial almashsa sahifa shu
// yerda qayta chiziladi (router.replace) — ochiq API yo'q.

export const metadata: Metadata = {
  title: `Imtihon natijalari — ${CENTER_NAME}`,
  description: "Oylik imtihon natijalari: fan, guruh, ustoz va har bir o'quvchining natijasi.",
  robots: { index: false, follow: false },
  ...(IS_AKADEMIYA ? { icons: { icon: "/sorovnoma/favicon.png" } } : {}),
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  let data: PublicResults | null = null;
  try {
    const db = await ensureIndexes();
    data = await loadPublicResults(db, { filial: first(sp.filial), oy: first(sp.oy) });
  } catch (e) {
    // Baza yiqilsa — sahifa ochiladi, «yuklab bo'lmadi» va «Qayta urinish» bilan.
    console.error("[natijalar]", e);
  }
  return <PublicResultsPage data={data} />;
}
