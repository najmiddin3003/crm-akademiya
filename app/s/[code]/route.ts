import { NextResponse } from "next/server";
import { countOpen, findActiveLink } from "@/lib/campaignLinks";
import { ensureIndexes } from "@/lib/mongodb";

// Kampaniya qisqa havolasi `/s/KOD` (36-qism, lib/campaignLinks.ts) — sessiyasiz (proxy.ts → PUBLIC_PATHS).
// Faol havola — ochilish sanaladi va so'rovnomaga `?c=KOD` bilan yo'naltiriladi; to'xtatilgan yoki noma'lum
// kod — oddiy so'rovnomaga (reklama qog'ozi qo'lda qolgan bo'lsa ham odam yo'qolmasin).
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await ensureIndexes();
  const link = await findActiveLink(db, code);
  const url = new URL("/sorovnoma", req.url);
  if (link) {
    await countOpen(db, link.code).catch(() => {});
    url.searchParams.set("c", link.code);
  }
  return NextResponse.redirect(url, 302);
}
