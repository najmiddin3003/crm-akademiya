import { cache } from "react";
import type { Metadata } from "next";
import { CENTER_NAME } from "@/lib/center";
import { ensureIndexes } from "@/lib/mongodb";
import { parseGroupResultsKey } from "@/lib/groupResultsLink";
import { loadGroupResults } from "@/lib/publicResults";
import PublicResultsPage from "@/components/imtihon/PublicResultsPage";

// GURUH NATIJALARI (01.11.2026, foydalanuvchi: «har bir guruh uchun alohida url link yaratsin»)
// — /natijalar/<guruh id>-<imzo>: bitta guruhning Sarhisob natijalari, oyma-oy, jadvalda.
// Havola Imtihon → Sarhisob'dagi «Havolani nusxalash» (yangi versiyada qator ⋯ menyusida,
// eskisida sarhisob oynasida); `?oy=YYYY-MM` — qaysi oy ochilsin (yo'q yoki o'sha oyda natija
// yo'q — eng oxirgisi). Kirish TALAB QILINMAYDI (proxy.ts → PUBLIC_PATHS, "/natijalar"
// prefiksi). Imzo mos kelmasa — «havola topilmadi»: raqamni o'zgartirib boshqa guruhni
// ochib bo'lmaydi (lib/groupResultsLink.ts).

type Params = Promise<{ kalit: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Sarlavha (generateMetadata) va sahifa bitta so'rovda bazani bir marta o'qisin.
const load = cache(async (groupId: number) => loadGroupResults(await ensureIndexes(), groupId));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const groupId = parseGroupResultsKey((await params).kalit);
  if (groupId === null) return {};
  try {
    const data = await load(groupId);
    return data ? { title: `${data.groupLabel} — imtihon natijalari · ${CENTER_NAME}` } : {};
  } catch {
    return {}; // xatoni sahifaning o'zi ko'rsatadi
  }
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const groupId = parseGroupResultsKey((await params).kalit);
  if (groupId === null) return <PublicResultsPage view="badlink" />;

  let data;
  try {
    data = await load(groupId);
  } catch (e) {
    // Baza yiqilsa — sahifa ochiladi, «yuklab bo'lmadi» va «Qayta urinish» bilan.
    console.error("[natijalar]", { groupId }, e);
    return <PublicResultsPage view="error" />;
  }
  if (!data) return <PublicResultsPage view="badlink" />;

  const raw = (await searchParams).oy;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const month = asked && MONTH_RE.test(asked) && data.exams.some((e) => e.month === asked) ? asked : (data.exams[0]?.month ?? null);
  return <PublicResultsPage view="results" data={data} month={month} />;
}
