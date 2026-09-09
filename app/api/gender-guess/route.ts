import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { chatBody, DEFAULT_BASE_URL, DEFAULT_MODEL, readGender } from "@/lib/genderGuess";

// POST /api/gender-guess  { name: "Aziza Karimova" }  →  { ok, gender }
//
// Xodim qo'shishda "Jinsi" ni ISM-FAMILIYAdan taxmin qiladi (sun'iy
// intellekt modeli orqali). Natija TAKLIF, xolos: modal uni faqat maydon
// qo'lda tegilmagan bo'lsa to'ldiradi.
//
// SOZLAMA (.env.local va Vercel > Environment Variables):
//   OPENAI_URL_API  — OpenAI API kaliti ("sk-..."). BO'SH BO'LSA route
//     jimgina `gender: ""` qaytaradi va shakl avvalgidek qo'lda
//     to'ldiriladi — kalit yo'qligi xodim qo'shishni TO'XTATMAYDI.
//   OPENAI_MODEL    — model nomi (sukut: lib/genderGuess.ts).
//   OPENAI_BASE_URL — proksi orqali ishlatilsa.
//
// NEGA SERVERDA: API kaliti brauzerga UMUMAN chiqmasligi kerak. Klient
// faqat ismni yuboradi.
//
// XATO HOLATIDA HAM 200 QAYTADI (`gender: ""` + `reason`). Sabab: bu
// yordamchi maydon, u yiqilganda shakl ishlashda davom etishi kerak.
// `reason` brauzer konsoliga chiqadi, ya'ni "nega to'ldirmayapti?" degan
// savol javobsiz qolmaydi (eng ko'p uchraydigani — model nomi noto'g'ri).

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Sessiya yetarli — route hech qanday ma'lumot ochmaydi, faqat
  // yuborilgan ismni tasniflaydi.
  if (!(await getCurrentUser())) {
    return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  if (name.length < 2) return NextResponse.json({ ok: true, gender: "" });

  const key = (process.env.OPENAI_URL_API || "").trim();
  if (!key) return NextResponse.json({ ok: true, gender: "", reason: "OPENAI_URL_API sozlanmagan" });

  const model = (process.env.OPENAI_MODEL || "").trim() || DEFAULT_MODEL;
  const base = ((process.env.OPENAI_BASE_URL || "").trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  try {
    // Shakl javobni kutib turmaydi, lekin osilib qolgan so'rov serverda
    // joy egallab turmasin.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(chatBody(model, name)),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    const data = await res.json();
    if (!res.ok) {
      const msg = String(data?.error?.message ?? `HTTP ${res.status}`);
      console.error("[gender-guess]", model, msg);
      return NextResponse.json({ ok: true, gender: "", reason: msg });
    }

    return NextResponse.json({ ok: true, gender: readGender(data?.choices?.[0]?.message?.content), model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "noma'lum xato";
    console.error("[gender-guess]", msg);
    return NextResponse.json({ ok: true, gender: "", reason: msg });
  }
}
