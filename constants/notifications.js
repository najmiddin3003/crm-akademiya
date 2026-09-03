// Navbardagi qo'ng'iroq paneli — SOF MA'LUMOT (loyihadagi odat: konstantalar
// .js da, tiplar va mantiq lib/notifications.ts da).
//
// Panel uch manbadan yig'iladi va ularning har biri BAZADAGI haqiqiy
// yozuvdan keladi:
//   payment — transaction_entries, txType "payIn" (kassaga tushgan pul)
//   order   — orders (yangi lid/buyurtma)
//   task    — tasks, muddati o'tgan va bajarilmagan topshiriq
//
// Ilgari bu yerda o'ylab topilgan besh qator turardi ("Dilnavoz Zokirjonova
// — 850 000 UZS"), qizil nuqta esa doim yonib turardi. Bazada bunday odam
// ham, bunday to'lov ham yo'q edi.

/** Qo'ng'iroq necha kunlik oynani ko'rsatadi. */
export const WINDOW_DAYS = 7;

/**
 * Manba boshiga BAZADAN o'qiladigan maksimum qator.
 *
 * Nishondagi son shu qatorlar ichida sanaladi. Chegaraga yetilsa panel buni
 * yashirmaydi — "N+" chizadi va bannerda aytadi (lib/notifications.ts).
 */
export const SOURCE_SCAN = 100;

/**
 * Manba boshiga EKRANDA chiziladigan qator (jami ko'pi bilan 24).
 *
 * NEGA MANBA BOSHIGA, umumiy chegara emas: bitta jonli kassa kuni butun
 * kunlik lidlarni va kechikkan topshiriqlarni ro'yxatdan siqib chiqarardi —
 * ya'ni panel eng kerakli qatorni aynan eng band kuni ko'rsatmasdi.
 */
export const SOURCE_SHOW = 8;

export const NOTIF_STYLES = {
  // i-wallet — Sidebar sprite'ida (AppShell uni har sahifada mount qiladi).
  payment: { bg: "bg-emerald-100", text: "text-emerald-600", icon: "i-wallet" },
  // i-user-plus — Navbar sprite'ida.
  order: { bg: "bg-blue-100", text: "text-blue-600", icon: "i-user-plus" },
  // i-clock-alert — Navbar sprite'iga shu panel uchun qo'shildi. `i-clock`
  // EMAS: u components/tasks/TasksPage.tsx dagi sahifa sprite'ida bor va
  // ikkinchi nusxa /tasks ochiq turganda hujjatda takroriy DOM id berardi.
  task: { bg: "bg-amber-100", text: "text-amber-600", icon: "i-clock-alert" },
};

/**
 * Notanish tur uchun zaxira uslub.
 *
 * NIMA NOTO'G'RI EDI: eski panel `NOTIF_STYLES[n.type].bg` ni qo'riqchisiz
 * o'qirdi. Ro'yxatdagi besh tur qattiq yozilgani uchun bu sezilmasdi, lekin
 * serverdan bitta notanish tur kelishi BUTUN NAVBARNI (ya'ni har bir
 * sahifani) yiqitish uchun yetarli edi.
 */
export const NOTIF_STYLE_FALLBACK = { bg: "bg-slate-100", text: "text-slate-600", icon: "i-bell" };

/** Bo'sh holat matnida sanaladigan nomlar. */
export const SOURCE_LABELS = {
  payment: "yangi to'lov",
  order: "yangi buyurtma",
  task: "kechikkan topshiriq",
};
