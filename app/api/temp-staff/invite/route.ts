import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminOnly";
import { activationMessage, generateToken, INVITE_TTL_MS, issueCode, normalizePhone, sendSms } from "@/lib/invite";
import { APPROVAL_FIELD, type AdminApproval } from "@/lib/adminApproval";
import { logSms } from "@/lib/smsLog";

// POST /api/temp-staff/invite  { ids: number[] }
// "Vaqtinchalik tugma" sahifasidagi FAOLLASHTIRISH SMS'i — bittaga ham,
// belgilangan bir nechtasiga ham. Ikkalasi bitta yo'ldan yuradi: alohida
// yuborish — shunchaki bir elementli ro'yxat.
//
// NEGA /api/auth/resend-invite EMAS:
//   • u xodimni ESKI `employees` kolleksiyasidagi `employeeId` (ObjectId)
//     bo'yicha qidiradi, bu sahifa esa `hr_employees.id` bilan ishlaydi;
//   • u faqat `status: "invited"` hisob uchun ishlaydi va HISOBI YO'Q
//     xodimga hech narsa qilmaydi — bu sahifada esa aynan o'sha holat
//     asosiy: hisobsiz xodimga birinchi taklifni yuborish kerak;
//   • u bittalab ishlaydi, natijani esa qatorlar kesimida ko'rsatish kerak.
//
// SMS HAQIQATAN ketadi va pul turadi. Shu bois:
//   • sahifada tasdiq oynasi bor (kimga ketishi ro'yxat bilan ko'rsatiladi);
//   • bu yerda partiya CHEGARALANGAN (quyida) — bir bosishda butun bazaga
//     yuborib yuborish imkoni bo'lmasin;
//   • FAOLLASHGAN hisobga yuborilmaydi: unda parol allaqachon bor va
//     faollashtirish havolasi unga hech narsa bermaydi.

export const runtime = "nodejs";
// Har bir SMS ~1 soniya (kod yaratish + Eskiz + jurnal). Vercel Hobby
// rejasida funksiya 60 soniya ishlaydi, shu bois partiya chegarasi past.
export const maxDuration = 60;

/** Bir so'rovda eng ko'pi shuncha xodimga yuboriladi. */
export const MAX_BATCH = 25;

interface InviteResult {
  id: number;
  name: string;
  ok: boolean;
  /** Nima uchun yuborilmagani — qatorning yonida ko'rsatiladi. */
  error?: string;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Bu sahifa faqat admin uchun" }, { status: 403 });
  }

  let body: { ids?: unknown; twoFactor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map(Number).filter((n) => Number.isFinite(n)))]
    : [];
  // "Ikki bosqichli tasdiqlash" — SMS oynasidagi tugmacha. Aynan SHU
  // YERDA, chunki qaror taklif yuborilayotgan paytda qabul qilinadi:
  // xodim parol qo'ygach kira oladimi yoki admin ✓ bosishini kutadimi.
  const twoFactor = body.twoFactor === true;
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Xodim tanlanmagan" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json(
      { ok: false, error: `Bir marta ${MAX_BATCH} tagacha xodimga yuborish mumkin (tanlandi: ${ids.length})` },
      { status: 400 },
    );
  }

  const db = await ensureIndexes();
  const employees = await db.collection("hr_employees").find({ id: { $in: ids } }).toArray();
  const byId = new Map(employees.map((e) => [Number(e.id), e]));

  const results: InviteResult[] = [];

  // KETMA-KET, parallel EMAS: Eskiz ham, Telegram ham bir vaqtda kelgan
  // o'nlab so'rovni cheklaydi, va xato bo'lganda qaysi qatorda
  // to'xtaganini aytish kerak.
  for (const id of ids) {
    const emp = byId.get(id);
    const name = String(emp?.name ?? `#${id}`);
    if (!emp) {
      results.push({ id, name, ok: false, error: "Xodim topilmadi" });
      continue;
    }
    const phone = normalizePhone(String(emp.phone ?? ""));
    if (!phone) {
      results.push({ id, name, ok: false, error: "Telefon raqami yo'q" });
      continue;
    }

    try {
      // Hisob TELEFON bo'yicha ham qidiriladi: importda qo'shilgan xodimda
      // `hrEmployeeId` bog'lanmagan bo'lishi mumkin va faqat id bo'yicha
      // qidirilsa, o'sha raqamda IKKINCHI hisob yaratilib qolardi.
      const users = db.collection("users");
      const existing = await users.findOne({ $or: [{ hrEmployeeId: id }, { phone }] });

      if (existing?.status === "active") {
        results.push({ id, name, ok: false, error: "Hisob allaqachon faollashgan" });
        continue;
      }

      // Kod AVVAL olinadi: soatlik chegaraga urilsa (lib/invite.ts —
      // soatiga 5 ta) token yangilanmasin, aks holda eski havola
      // ishlamay qolardi-yu, yangisi yuborilmasdi ham.
      const code = await issueCode(phone, "activate");
      if (!code.ok || !code.code) {
        results.push({ id, name, ok: false, error: code.error || "Kod yaratilmadi" });
        continue;
      }

      const token = generateToken();
      const invite = { token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
      // Tugmacha O'CHIQ bo'lsa maydon BUTUNLAY olib tashlanadi (`false`
      // yozilmaydi): "talab qilinmagan" bilan "tasdiqlangan" ni ajratish
      // uchun. Ilgari yuborilgan taklifda ikki bosqich yoqiq bo'lsa, uni
      // o'chiq holda qayta yuborish talabni ham bekor qiladi.
      const approvalPatch = twoFactor
        ? { $set: { [APPROVAL_FIELD]: "pending" as AdminApproval } }
        : { $unset: { [APPROVAL_FIELD]: "" } };

      if (existing) {
        await users.updateOne({ _id: existing._id }, {
          $set: { invite, hrEmployeeId: id, status: "invited" },
          ...approvalPatch,
        });
      } else {
        await users.insertOne({
          phone,
          hrEmployeeId: id,
          fullName: name,
          role: String(emp.turi ?? "") || "employee",
          status: "invited",
          passwordHash: null,
          invite,
          createdAt: new Date(),
          activatedAt: null,
          ...(twoFactor ? { [APPROVAL_FIELD]: "pending" as AdminApproval } : {}),
        });
      }
      // Xodim kartochkasida ham ko'rinib tursin (hr_employees.twoFactor) —
      // ilgari bu bayroq faqat saqlanardi va hech narsaga ta'sir qilmasdi.
      await db.collection("hr_employees").updateOne({ id }, { $set: { twoFactor } });

      const sms = await sendSms(phone, activationMessage(token, code.code));
      // `secret: true` — matnda bir martalik token va kod bor, ular
      // jurnalga YOZILMAYDI (app/api/hr-employees dagi bilan bir xil).
      await logSms(db, {
        recipientName: name, phone, text: "",
        purpose: "invite", kind: "auto", secret: true, result: sms,
      });
      results.push({ id, name, ok: sms.ok, error: sms.ok ? undefined : (sms.error || "SMS yuborilmadi") });
    } catch (e) {
      results.push({ id, name, ok: false, error: e instanceof Error ? e.message : "Xato" });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, sent, failed: results.length - sent, results });
}
