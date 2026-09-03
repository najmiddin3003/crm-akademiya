import { after } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "./mongodb";
import { resolvePermissions, type UserForPermissions } from "./rolePermissions";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { uzNow } from "./uzTime";

export interface CurrentUser {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  /** Joriy qurilma sessiyasi (eski cookie'larda bo'lmasligi mumkin). */
  sid?: string;
  /**
   * Xodim ko'ra oladigan bo'limlar (lib/permissions.ts).
   * `null` — cheklov yo'q.
   *
   * Cookie'da EMAS, har so'rovda DB'dan o'qiladi: rol ruxsatlari
   * o'zgartirilganda xodim qayta login qilishini kutib o'tirmasin, hamda
   * cookie'ni o'zi tahrirlab ruxsat qo'shib ololmasin.
   */
  permissions: string[] | null;
  /**
   * Xodim yozuvining id'si (`hr_employees.id`).
   *
   * Hujjatdan ALLAQACHON o'qilardi (pastdagi proyeksiyaga qarang), lekin
   * tashqariga berilmasdi — natijada `getCurrentEmployee()` uni olish uchun
   * butun zanjirni (`getCurrentUser` + `users.findOne`) qaytadan yurardi.
   */
  hrEmployeeId: number | null;
  /**
   * Qo'ng'iroq paneli kursorlari — manba boshiga "shu vaqtgacha ko'rilgan"
   * ISO tamg'asi (app/api/notifications). Panel har 60 soniyada so'raladi,
   * ya'ni buning uchun alohida `users` o'qishi ochiq isrof bo'lardi.
   */
  lastSeenNotifAt: Record<string, string> | null;
}

// Joriy so'rovdagi sessiya cookie'sini tekshirib, DB'dagi jonli holatini
// o'qiydi. Sessiya imzosi to'g'ri bo'lsa ham, admin foydalanuvchini
// muzlatgan/bloklagan/o'chirgan bo'lsa null qaytadi — shu orqali (app)
// layout uni keyingi sahifada darhol chiqarib yuboradi.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session || !ObjectId.isValid(session.uid)) return null;

  const db = await ensureIndexes();

  // IKKALA O'QISH BARAVARIGA. Ular bir-biriga bog'liq emas: `session.uid`
  // ham, `session.sid` ham allaqachon tekshirilgan cookie'dan keladi, biri
  // ikkinchisining natijasini kutmaydi. Ilgari bu yerda 5 ta KETMA-KET
  // Atlas so'rovi bor edi (users → user_sessions → updateOne →
  // hr_employees → roles) va (app)/layout.tsx har bir sahifa ochilishida
  // shuni kutardi. O'lchandi: 818 ms.
  //
  // Foydalanuvchi hujjatidan faqat quyidagi maydonlar o'qiladi (parol xeshi
  // umuman kerak emas) — lib/rolePermissions.ts dagi loadAccess bilan bir xil.
  const [user, live] = await Promise.all([
    db.collection("users").findOne(
      { _id: new ObjectId(session.uid) },
      { projection: { status: 1, phone: 1, fullName: 1, role: 1, hrEmployeeId: 1, lastSeenNotifAt: 1 } },
    ),
    session.sid
      ? db.collection("user_sessions").findOne({ sid: session.sid })
      : Promise.resolve(null),
  ]);

  if (!user || user.status !== "active") return null;

  // Qurilma sessiyasi uzilgan bo'lsa ("Aktiv qurilmalar" da chiqarilgan),
  // keyingi sahifa ochilishida foydalanuvchi chiqarib yuboriladi.
  // `sid` yo'q eski cookie'lar amal qilaveradi — pastdagi izohga qarang.
  if (session.sid) {
    if (!live) return null;

    // Oxirgi faollik vaqti — RO'YXATDA ko'rsatiladigan bezak ma'lumot,
    // natijasi hech qayerda o'qilmaydi. Shu sabab u javobdan KEYIN
    // yoziladi: ilgari har bir sahifa render'i shu YOZUVni kutib turardi.
    // `after` Server Component va Route Handler'da ishlaydi va route'ni
    // dinamik qilib qo'ymaydi (next/dist/docs → functions/after.md).
    const p = (n: number) => String(n).padStart(2, "0");
    const d = uzNow();
    const lastSeenAt = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
    after(async () => {
      await db.collection("user_sessions").updateOne({ sid: session.sid }, { $set: { lastSeenAt } });
    });
  }

  return {
    id: user._id.toString(),
    phone: user.phone,
    fullName: user.fullName,
    role: user.role || "employee",
    sid: session.sid,
    permissions: await resolvePermissions(db, user as UserForPermissions),
    hrEmployeeId: Number.isFinite(Number(user.hrEmployeeId)) ? Number(user.hrEmployeeId) : null,
    // Maydon YO'Q bo'lsa `null` — qo'ng'iroq hech ochilmagan. Route uni oyna
    // boshiga tenglashtiradi, "hozir" ga EMAS: aks holda birinchi kirishda
    // bir haftalik haqiqiy hodisa jimgina o'qilgan bo'lib qolardi.
    lastSeenNotifAt:
      user.lastSeenNotifAt && typeof user.lastSeenNotifAt === "object"
        ? (user.lastSeenNotifAt as Record<string, string>)
        : null,
  };
}
