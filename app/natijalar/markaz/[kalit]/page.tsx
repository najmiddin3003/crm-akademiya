import { cache } from "react";
import type { Metadata } from "next";
import { CENTER_NAME } from "@/lib/center";
import { ensureIndexes } from "@/lib/mongodb";
import { decodeShare } from "@/lib/centerShare";
import { parseCenterResultsKey } from "@/lib/groupResultsLink";
import { loadCenterRanking } from "@/lib/publicResults";
import { imMonthLabel } from "@/lib/imtihon";
import PublicResultsPage from "@/components/imtihon/PublicResultsPage";

// MARKAZ REYTINGI — OCHIQ HAVOLA (01.11.2026, foydalanuvchi: «reytingni ulashish ishlasin,
// markaz bo'yicha reytingni ulashish») — /natijalar/markaz/<filial id>-<qismlar>-<imzo>: filialning oylik
// imtihon reytingi (CRM'dagi Imtihon → Sarhisob → «Markaz reytingi» bilan bitta qoida —
// lib/examRanking.ts). Havola o'sha ko'rinishdagi «Ulashish» oynasidan; kalitda filial va oynada
// belgilangan qismlar (lib/centerShare.ts) — imzo bilan. `?oy=YYYY-MM` — qaysi oy (yo'q yoki
// o'sha oyda natija yo'q — eng oxirgisi), `?fan=` — qaysi fan (serverda kesiladi).
// Kirish TALAB QILINMAYDI (proxy.ts → PUBLIC_PATHS, "/natijalar" prefiksi). Imzo mos kelmasa —
// «havola topilmadi» (lib/groupResultsLink.ts → parseCenterResultsKey).

type Params = Promise<{ kalit: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const askedMonth = (v: string | string[] | undefined) => {
  const m = first(v);
  return m && MONTH_RE.test(m) ? m : null;
};

/** Havoladagi fan — bo'lsa, shu fan ichida reyting (uzunligi cheklangan: bazaga erkin matn bormasin). */
const askedCourse = (v: string | string[] | undefined) => (first(v) ?? "").trim().slice(0, 120);

// Sarlavha (generateMetadata) va sahifa bitta so'rovda bazani bir marta o'qisin.
const load = cache(async (branchId: number, mask: number, month: string | null, course: string) =>
  loadCenterRanking(await ensureIndexes(), branchId, decodeShare(mask), month, course),
);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const key = parseCenterResultsKey((await params).kalit);
  if (!key) return {};
  try {
    const sp = await searchParams;
    const data = await load(key.branchId, key.mask, askedMonth(sp.oy), askedCourse(sp.fan));
    if (!data) return {};
    const month = data.month ? ` — ${imMonthLabel(data.month)}` : "";
    return {
      title: `Markaz reytingi${month} · ${CENTER_NAME}`,
      description: "Oylik imtihon natijalari: markaz bo'yicha o'rinlar.",
    };
  } catch {
    return {}; // xatoni sahifaning o'zi ko'rsatadi
  }
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const key = parseCenterResultsKey((await params).kalit);
  if (!key) return <PublicResultsPage view="badlink" kind="center" />;

  const sp = await searchParams;
  let data;
  try {
    data = await load(key.branchId, key.mask, askedMonth(sp.oy), askedCourse(sp.fan));
  } catch (e) {
    // Baza yiqilsa — sahifa ochiladi, «yuklab bo'lmadi» va «Qayta urinish» bilan.
    console.error("[natijalar/markaz]", { branchId: key.branchId }, e);
    return <PublicResultsPage view="error" />;
  }
  if (!data) return <PublicResultsPage view="badlink" kind="center" />;
  return <PublicResultsPage view="center" data={data} />;
}
