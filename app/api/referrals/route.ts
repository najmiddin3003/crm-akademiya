import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { addLink, addReferrer, decideRequest, loadReferrals, requestGift, saveGift, saveRefSettings, searchPeople, REF_LINKS } from "@/lib/referrals";

// Sotuv va marketing → Referallar (29-qism, lib/referrals.ts).
//   GET — taklif qiluvchilar, takliflar, sovg'alar, so'rovlar, sozlamalar; GET ?search=q — lid / o'quvchi qidiruvi.
//   POST {action}: referrer | link | unlink | gift | give | request | decide | settings (faqat admin).

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const q = new URL(req.url).searchParams.get("search");
  if (q !== null) return NextResponse.json({ ok: true, ...(await searchPeople(db, scope.allowed, q)) });
  return NextResponse.json(await loadReferrals(db, scope.allowed));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = await ensureIndexes();
  const by = await currentAuthorName();
  let out: { ok: boolean; error?: string; status?: number };
  switch (b.action) {
    case "referrer":
      out = await addReferrer(db, scope.branchId, by, b);
      break;
    case "link":
      out = await addLink(db, scope.allowed, by, b);
      break;
    case "unlink":
      out = (await db.collection(REF_LINKS).deleteOne({ id: Number(b.id) })).deletedCount ? { ok: true } : { ok: false, error: "Topilmadi", status: 404 };
      break;
    case "gift":
      out = await saveGift(db, b);
      break;
    case "give":
    case "request":
      out = await requestGift(db, scope.allowed, by, Number(b.referrerId), Number(b.giftId), b.action === "give");
      break;
    case "decide":
      out = await decideRequest(db, scope.allowed, by, Number(b.id), b.approve === true, String(b.comment ?? ""));
      break;
    case "settings":
      if (!scope.isAdmin) return NextResponse.json({ ok: false, error: "Sozlamani faqat administrator o'zgartiradi" }, { status: 403 });
      out = await saveRefSettings(db, b);
      break;
    default:
      out = { ok: false, error: "Noma'lum amal", status: 400 };
  }
  return NextResponse.json(out, { status: out.ok ? 200 : (out.status ?? 400) });
}
