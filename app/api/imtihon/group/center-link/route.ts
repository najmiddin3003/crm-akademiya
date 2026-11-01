import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { isValidShareMask } from "@/lib/centerShare";
import { centerResultsKey } from "@/lib/groupResultsLink";

// Imtihon → Sarhisob → «Markaz reytingi» → «Ulashish» oynasi (01.11.2026): belgilangan qismlar
// (`f` — lib/centerShare.ts dagi bitlar) uchun JORIY FILIALNING ochiq reyting kaliti
// (/natijalar/markaz/<kalit>, lib/groupResultsLink.ts). Imzo serverda — mijoz qismlarni o'zi
// imzolay olmaydi. Bazaga hech narsa yozilmaydi.
//
// Ruxsat: proxy.ts — `/api/imtihon/group/[id]` naqshi orqali Imtihon sahifasi ruxsati
// (lib/apiPermissions.generated.ts; generator qayta yurganda shu yo'l alohida yoziladi).
// Qamrov — GET /api/imtihon/group bilan bir xil (`scope.branchId`, hovuz ochiq sahifada).

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("f") ?? "";
  const mask = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  if (!isValidShareMask(mask)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  return NextResponse.json({ ok: true, key: centerResultsKey(scope.branchId, mask) });
}
