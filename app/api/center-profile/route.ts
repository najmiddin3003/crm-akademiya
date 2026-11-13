import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { branchAddressLine, branchPhoneDigits } from "@/lib/managementBranches";
import { cleanReceiptProfile, type ReceiptBranch } from "@/lib/receiptProfile";

// GET /api/center-profile — chek sozlamasi + joriy filialning manzili va telefoni.
// Kassa chekini chop etadigan har kim o'qiydi (sessiya yetarli — jadvalda yo'q yangi
// route sukut bo'yicha «session», lib/apiPermissions.ts).
//
// PUT /api/center-profile {receipt:{showLogo,title,footer}} — FAQAT ADMIN
// (rasm: «Sozlamalar → Markaz ma'lumotlari»). Alohida kolleksiya `center_profile` —
// umumiy `settings` emas: unga PUT /api/settings 14 sahifa ruxsati bilan har qanday
// kalitni yozadi.

async function currentBranch(): Promise<ReceiptBranch | null> {
  const scope = await getBranchScope();
  if (!scope) return null;
  const db = await ensureIndexes();
  const b = await db.collection("branches").findOne({ id: scope.branchId });
  if (!b) return null;
  const digits = branchPhoneDigits(b.phone as string | undefined);
  return {
    name: String(b.name ?? ""),
    address: branchAddressLine({ location: String(b.location ?? ""), address: String(b.address ?? "") }),
    phone: digits ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}` : "",
  };
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  const db = await ensureIndexes();
  const [doc, branch] = await Promise.all([db.collection("center_profile").findOne({ key: "main" }), currentBranch()]);
  return NextResponse.json({
    ok: true,
    receipt: cleanReceiptProfile(doc?.receipt),
    saved: !!doc?.receipt,
    branch,
    canEdit: me.role === "admin",
  });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  if (me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Markaz ma'lumotlarini faqat administrator o'zgartiradi" }, { status: 403 });
  }
  let body: { receipt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const receipt = cleanReceiptProfile(body.receipt);
  if (!receipt.title) return NextResponse.json({ ok: false, error: "Chek sarlavhasini kiriting" }, { status: 400 });
  const db = await ensureIndexes();
  await db.collection("center_profile").updateOne(
    { key: "main" },
    { $set: { key: "main", receipt, updatedAt: new Date(), updatedBy: me.fullName || me.phone } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true, receipt });
}
