// Ported from crm-akademiya/src/app.js:
// _NAMES_F/_NAMES_L/_TEACHERS/_COURSES/_LEVELS/_MODS/_PREFIX (~line 267),
// _genPhone/_genDate (~line 276), buildOrders (~line 296),
// _augmentOrders (~line 23074), ORDER_STAGES + _augmentOrdersKanban (~line 24065),
// getPageButtons (~line 22910).

import type { AnyLeadStatusKey } from "./leadStatus";
import type { LeadGuruh, LeadHolat, LeadHolatEvent, LeadHolatSnapshot } from "./leadHolat";
import type { LeadDaraja } from "./leadSettings";
import { uzNow } from "./uzTime";

export type OrderStageKey = "bir_oylay" | "jaylang_e" | "rahmaaaat" | "ketdim";

/**
 * "Birinchi darsga yozilganlar" sahifasidagi HOLAT — buyurtmaning o'z
 * `status`idan alohida. Lid birinchi darsga yozilgandan keyin shu yerda
 * kuzatiladi: eslatildimi, keldimi, kelmadimi, guruhga qo'shildimi...
 */
export type FirstLessonStatus =
  | "YOZILDI" | "ESLATILDI" | "KELDI" | "KELMADI"
  | "QAYTA_BELGILANDI" | "GURUHGA_QOSHILDI" | "RAD_ETDI" | "ALOQA_KERAK";

export const FIRST_LESSON_STATUSES: { value: FirstLessonStatus; label: string }[] = [
  { value: "YOZILDI", label: "Yozildi" },
  { value: "ESLATILDI", label: "Eslatildi" },
  { value: "KELDI", label: "Keldi" },
  { value: "KELMADI", label: "Kelmadi" },
  { value: "QAYTA_BELGILANDI", label: "Qayta belgilandi" },
  { value: "GURUHGA_QOSHILDI", label: "Guruhga qo'shildi" },
  { value: "RAD_ETDI", label: "Rad etdi" },
  { value: "ALOQA_KERAK", label: "Aloqa kerak" },
];

export function firstLessonStatusLabel(v: string | undefined): string {
  return FIRST_LESSON_STATUSES.find((s) => s.value === v)?.label ?? "";
}

export interface Order {
  /** TEXNIK kalit — butun tizim bo'yicha unikal; manzil (/orders-list/[id])
   * va bog'lanishlar shunga tayanadi. Foydalanuvchiga KO'RSATILMAYDI. */
  id: number;
  /**
   * Filial ichidagi TARTIB RAQAMI — ro'yxatlardagi "ID" ustuni, Telegram
   * xabaridagi "#…". Har filial o'zining 1, 2, 3… raqamlashiga ega
   * (foydalanuvchi so'rovi, 11.09.2026): 1-filial moderatori lid qo'shsa
   * u 1-filialning navbatdagi raqamini oladi, boshqa filialdagilar hisobga
   * olinmaydi. Yaratilishda beriladi (POST /api/orders), eski lidlar
   * scripts/backfill-order-branch-no.mjs bilan to'ldirilgan.
   * Ko'rsatishda `orderNo(o)` ishlatiladi — raqam yo'q bo'lsa `id`.
   */
  branchNo?: number;
  name: string;
  phone: string;
  created: string;
  firstLesson: string;
  teacher: string;
  course: string;
  level: string;
  moderator: string;
  note: string;
  isNew?: boolean;
  group: string;
  status: string;
  source: string;
  subsource: string;
  fromBranch: string;
  toBranch: string;
  category: string;
  survey: string;
  subcourse: string;
  /**
   * Lid voronkasidagi bosqich ("rang"). Yangi buyurtmada BO'SH bo'ladi —
   * telefon raqam chipi betaraf kulrang turadi, moderator raqamni bosib
   * bosqich tanlagach rangga kiradi. Bosqichsiz lid Kanban ustunlariga
   * tushmaydi (referensda ham shunday: ro'yxatdagi lidlar soni Kanbandagi
   * ustunlar yig'indisidan ko'p).
   */
  stage?: OrderStageKey;
  dayPattern: string;
  taskStatus: string;
  referral: string;
  /**
   * «Referal bergan o'quvchi» ning id'si (26.09.2026 dan, gamifikatsiya TZ
   * 4.12 — «Do'st olib keldi» bonusi). `referral` ismi ko'rinish uchun
   * qoladi; ismdosh o'quvchilar bo'lsa id aniqlanmaydi (null).
   */
  referralPupilId?: number | null;
  /** Lid qaysi o'quvchiga aylangani — «Guruhga qo'shish» da yoziladi (lib/enrollStudent.ts). */
  pupilId?: number | null;
  lessonDay: string;
  lessonStartTime: string;
  /** Birinchi darsga yozilganlar sahifasidagi holat. Kiritilmagan bo'lishi mumkin. */
  firstLessonStatus?: FirstLessonStatus;
  /**
   * O'quvchi HAQIQATDA qo'shilgan guruhning id'si — "Guruhga qo'shish"
   * amali bajarilganda yoziladi (/api/groups/:id/students ga qo'shilgach).
   *
   * Yuqoridagi `group` maydonidan farqi: u buyurtma formasidagi
   * "Yig'ilayotgan guruh" tanlovi, ya'ni shunchaki niyat. `groupId` esa
   * lid o'quvchiga aylanganini bildiradi va buyurtma detali sahifasida
   * bunday qatorlar boshqa ko'rsatilmaydi.
   */
  groupId?: number;
  /**
   * Telegram guruhidagi tugma bilan qo'yilgan status (lib/leadStatus.ts).
   *
   * Buyurtmaning `status` maydonidan ALOHIDA: u CRM'dagi ish jarayoni
   * ("Yangi", "Qabul qilindi" …), bu esa moderatorning guruhdagi tezkor
   * belgisi — lid bilan bog'lanildimi va natija nima. Bo'sh bo'lsa
   * xabarda "Hali bog'lanilmadi" turadi. 29.09.2026 gacha bosilganlarda
   * eski kalit ("first", "later", "pay", "reject") qolgan.
   */
  leadStatus?: AnyLeadStatusKey;
  /** Status qo'yilgan payt — "DD.MM.YYYY | HH:MM" (loyihadagi ko'rinish). */
  leadStatusAt?: string;
  /** Tugmani bosgan Telegram foydalanuvchisining ko'rinadigan ismi. */
  leadStatusBy?: string;

  // ── Lidlar sahifasi (23.09.2026) — voronka, lib/leadHolat.ts ─────────
  /** Voronkadagi holat. Eski lidlarda yo'q — `holatOf()` hisoblaydi. */
  holat?: LeadHolat;
  /** Holat o'zgargan lahza (ISO) va kim o'zgartirgani. */
  holatAt?: string;
  holatBy?: string;
  /** «Rad etdi» sababi (Sozlamalar → Lidlar ro'yxatidan). */
  radSabab?: string;
  /**
   * Guruh tafsiloti (jadval, 1-dars sanasi) — «Guruhga qo'shish» oynasidan.
   * Nomi va id'si `group`/`groupId` da ham turadi; eski sahifa guruhni
   * o'zgartirsa bu maydon o'chiriladi (PATCH), eskirgan nusxa qolmasin.
   * Sinov darsi uchun alohida maydon YO'Q — `firstLesson`/`teacher` o'zi
   * (`sinovOf`), ikki nusxa bir-biridan ajrab ketmasin.
   */
  guruh?: LeadGuruh;
  /** Lid kartasidagi tarix (eski lidlarda yo'q). */
  holatTarix?: LeadHolatEvent[];
  /** Bekor qilish uchun oldingi holatlar (oxirgisi — eng so'nggi). */
  holatOldin?: LeadHolatSnapshot[];
  // ── Ommaviy so'rovnoma javoblari (/sorovnoma) ─────────────────────────
  /** Yo'nalish: "fan" | "til" | "pm" (lib/leadSettings.ts). */
  yonalish?: string;
  /** Chet tili darajasi (faqat "til" yo'nalishida). */
  daraja?: LeadDaraja;
  sinf?: string;
  /** "Qaysi vaqt qulay?" javobi. */
  qulayVaqt?: string;
  /** "Bizni qayerdan bildingiz?" — `source` (kanal) dan alohida. */
  heardFrom?: string;
  /** Lid qaysi filialda (lib/branchScope.ts). Eski hujjatlarda yo'q bo'lishi mumkin. */
  branchId?: number;
  /** Telegram "Lidlar" topigidagi xabar — holat CRM'da o'zgarsa tahrirlanadi. */
  tgMessage?: { chatId: string; messageId: number };
  /**
   * Botda o'zi ro'yxatdan o'tgan odamning Telegram hisobi (16.10.2026,
   * lib/studentBot/signup.ts) — xodim unga Telegramda ham yoza olsin.
   * Faqat server yozadi (lib/leadHolatServer.ts → SERVER_MANAGED_ORDER_FIELDS).
   */
  tgUser?: { chatId: number; username?: string; name?: string };
}

// 30.10.2026: demo buyurtmalar generatori (createInitialOrders — 502 ta yozuv, ism va
// telefonlar Akademiya'ning eski tizimidan) ishlatilgan ro'yxatlar bilan birga olib
// tashlandi: boshqa markaz saytida ko'rinardi. Lidlar faqat bazadan (/api/orders).

// Buyurtma HOLATLARI. Yorliqlar referensdagi (akademiya.edutizim.uz)
// ro'yxat bilan bir xil, QIYMATLAR esa bazaga haqiqatan yoziladigan
// satrlar — ular boshqa so'z shaklida ("Qabul qilindi", "Bekor qilindi";
// OrderDetailPage va FirstLessonsPage shularni PATCH qiladi).
//
// Ilgari bu oddiy satrlar massivi edi va yorliq qiymat sifatida ham
// ishlatilardi, ya'ni /orders-list dagi "Holatlar" filtri "Yangi" dan
// boshqa hech qachon hech narsani topmasdi.
export const STATUSES: { value: string; label: string }[] = [
  { value: "Yangi", label: "Yangi" },
  { value: "Qabul qilindi", label: "Qabul qilingan" },
  { value: "Kelmoqda", label: "Kelmoqda" },
  { value: "Kutilmoqda", label: "Kutilmoqda" },
  { value: "Bekor qilindi", label: "Bekor qilingan" },
  { value: "Yakunlandi", label: "Yakunlangan" },
  { value: "O'tkazildi", label: "O'tkazilgan" },
];

// Buyurtma MANBALARI. Referensda bu qiymatlar boshqa tizimdan (bot / sayt
// integratsiyasi) keladi — bizda hali o'sha manba ulanmagan, shu bois
// hozircha qo'lda yozilgan. README dagi "Keyinchalik qilinadigan ishlar"ga
// qarang.
export const ORDER_SOURCES = ["bot", "interface", "kommo", "survey", "tilda"];
export const SUBSOURCES = ["Reklama", "Post", "Story", "Taklif", "Boshqa"];
export const CATEGORIES = ["VIP", "Standart", "Imtiyozli"];
export const SURVEYS = ["Asosiy", "Qo'shimcha"];
export const SUBCOURSES = ["1-bosqich", "2-bosqich", "3-bosqich", "4-bosqich", "5-bosqich", "6-bosqich"];
export const WEEKDAY_NAMES = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

// AddOrderModal'dagi "Dars kunini tanlang" — bir nechta kun tanlanadi va
// buyurtmada production reference'dagi (akademiya.edutizim.uz) ko'rinishda
// saqlanadi: qisqartmalar vergul bilan, masalan "Du,Ch,Ju".
export interface LessonDayOption {
  /** Buyurtmada saqlanadigan qisqartma. */
  code: string;
  label: string;
}

export const LESSON_DAYS: LessonDayOption[] = [
  { code: "Du", label: "Dushanba" },
  { code: "Se", label: "Seshanba" },
  { code: "Ch", label: "Chorshanba" },
  { code: "Pa", label: "Payshanba" },
  { code: "Ju", label: "Juma" },
  { code: "Sh", label: "Shanba" },
  { code: "Ya", label: "Yakshanba" },
];

/** Tez tanlash uchun ikkita odatiy jadval (referensda alohida variant edi). */
export const LESSON_DAY_PRESETS: { label: string; codes: string[] }[] = [
  { label: "Toq kunlar", codes: ["Du", "Ch", "Ju"] },
  { label: "Juft kunlar", codes: ["Se", "Pa", "Sh"] },
];

const DAY_ORDER = LESSON_DAYS.map((d) => d.code);

/**
 * Buyurtmadagi `lessonDay` satrini tanlangan kunlar ro'yxatiga aylantiradi.
 * Eski yozuvlar turli ko'rinishda bo'lishi mumkin — qisqartma ("Du,Ch"),
 * to'liq nom ("Dushanba") yoki naqsh nomi ("Toq kunlar"); hammasi tushuniladi.
 */
export function parseLessonDays(value: string | undefined | null): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const preset = LESSON_DAY_PRESETS.find((p) => p.label.toLowerCase() === raw.toLowerCase());
  if (preset) return [...preset.codes];

  const out = new Set<string>();
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const hit = LESSON_DAYS.find(
      (d) => d.code.toLowerCase() === part.toLowerCase() || d.label.toLowerCase() === part.toLowerCase(),
    );
    if (hit) out.add(hit.code);
  }
  return DAY_ORDER.filter((c) => out.has(c));
}

/** Tanlangan kunlarni saqlanadigan satrga: ["Ch","Du"] → "Du,Ch". */
export function formatLessonDays(codes: string[]): string {
  return DAY_ORDER.filter((c) => codes.includes(c)).join(",");
}

/** Ko'rsatish uchun to'liq nomlar: "Du,Ch" → "Dushanba, Chorshanba". */
export function lessonDaysLabel(codes: string[]): string {
  return DAY_ORDER.filter((c) => codes.includes(c))
    .map((c) => LESSON_DAYS.find((d) => d.code === c)?.label ?? c)
    .join(", ");
}

export const ORDER_STAGES: { key: OrderStageKey; label: string; uppercase: string; emoji: string }[] = [
  // Emojilar referensdan olingan (lid voronkasida shular chiqadi).
  { key: "bir_oylay", label: "Bir o'ylay", uppercase: "BIR O'YLAY", emoji: "🤔" },
  { key: "jaylang_e", label: "Jaylang-e!", uppercase: "JAYLANG-E!", emoji: "🤝" },
  { key: "rahmaaaat", label: "Rahmaaaat!", uppercase: "RAHMAAAAT!", emoji: "🤗" },
  { key: "ketdim", label: "Ketdim", uppercase: "KETDIM", emoji: "🤬" },
];

// Add/edit-order drawer (components/orders/AddOrderModal.tsx) form values +
// the pure Order-building logic. buildOrderFromValues runs server-side
// (app/api/orders/route.ts, POST) and applyOrderValues runs client-side
// (components/orders/OrdersContext.tsx, before PATCHing the merged order) —
// both shared so the field mapping is defined exactly once.
export interface NewOrderValues {
  studentName: string;
  phone: string;
  referral: string;
  /** `referral` ismi YAGONA o'quvchiga tegishli bo'lsa — uning id'si (pupilIdByName). */
  referralPupilId?: number | null;
  course: string;
  lessonDay: string;
  lessonStartTime: string;
  teacher: string;
  group: string;
  firstLessonDate: string;
  firstLessonTime: string;
  note: string;
  /**
   * Kanbandagi to'liq sahifa formasi (components/orders/AddOrderPage.tsx) buni
   * ATAYLAB tanlaydi — lid boshqa xodimga biriktirilishi mumkin. Yon oyna
   * (AddOrderModal.tsx) esa yubormaydi va o'shanda POST /api/orders lidni
   * QO'SHGAN xodim ismini o'zi qo'yadi (`stage` esa quyidagi sukutda qoladi).
   */
  moderator?: string;
  stage?: OrderStageKey;
  /**
   * Lidning manbasi. Lid formasida bunday maydon YO'Q — "Manba" o'quvchida
   * saqlanadi ("Yangi o'quvchi qo'shish" formasidagi majburiy tanlov,
   * `pupils.source`). Qiymatni SERVER qo'yadi: app/api/orders/route.ts
   * lidga tegishli o'quvchini topib, uning manbasini shu yerga uzatadi.
   */
  source?: string;
}

/** Referal o'quvchi id'si — faqat ism tanlangan va id butun son bo'lsa. */
function refId(values: NewOrderValues): number | null {
  const n = Number(values.referralPupilId);
  return values.referral?.trim() && Number.isInteger(n) && n > 0 ? n : null;
}

function firstLessonFromValues(values: NewOrderValues): string {
  return values.firstLessonDate
    ? `${values.firstLessonDate.split("-").reverse().join(".")}${values.firstLessonTime ? ` | ${values.firstLessonTime}` : ""}`
    : "";
}

/** Ro'yxatlarda ko'rsatiladigan raqam: filial ichidagi tartib raqami, bo'lmasa texnik id. */
export function orderNo(o: Pick<Order, "id" | "branchNo">): number {
  return o.branchNo ?? o.id;
}

export function buildOrderFromValues(nextId: number, values: NewOrderValues): Order {
  const now = uzNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    id: nextId,
    name: values.studentName,
    phone: values.phone,
    referral: values.referral,
    referralPupilId: refId(values),
    course: values.course,
    lessonDay: values.lessonDay,
    lessonStartTime: values.lessonStartTime,
    teacher: values.teacher,
    moderator: values.moderator ?? "",
    note: values.note,
    created,
    firstLesson: firstLessonFromValues(values),
    // Birinchi dars belgilangan bo'lsa lid darhol "Yozildi" holatida boshlanadi.
    firstLessonStatus: values.firstLessonDate ? "YOZILDI" : undefined,
    level: "",
    group: values.group,
    isNew: true,
    stage: values.stage,
    dayPattern: "Juft kunlar",
    taskStatus: "Topshiriq yo'q",
    status: "Yangi",
    // ILGARI: `source: "Sayt"` — qattiq yozilgan edi va o'lchandi: bazadagi
    // 98 ta lidning HAMMASIDA shu qiymat turardi. Ya'ni o'quvchi qo'shishda
    // tanlangan "Manba" ("Tavsiya", "Instagram", …) hech qayerga yetib
    // bormasdi — Telegramdagi lid xabari ham doim "Manba: Sayt" deb chiqardi.
    // Endi qiymat o'quvchining yozuvidan keladi (route izohiga qarang);
    // o'quvchi topilmasa BO'SH — noma'lum manbani to'qib yozgandan yaxshiroq.
    source: values.source?.trim() || "",
    subsource: "",
    fromBranch: "",
    toBranch: "",
    category: "",
    survey: "",
    subcourse: "",
  };
}

export function applyOrderValues(order: Order, values: NewOrderValues): Order {
  return {
    ...order,
    name: values.studentName,
    phone: values.phone,
    referral: values.referral,
    referralPupilId: refId(values),
    course: values.course,
    lessonDay: values.lessonDay,
    lessonStartTime: values.lessonStartTime,
    teacher: values.teacher,
    group: values.group,
    note: values.note,
    firstLesson: firstLessonFromValues(values),
  };
}

export interface OrdersFilters {
  course: string;
  subcourse: string;
  group: string;
  teacher: string;
  moderator: string;
  status: string;
  status1: string;
  source: string;
  subsource: string;
  fromBranch: string;
  toBranch: string;
  day: string;
  survey: string;
  category: string;
  search: string;
  /** "Yaratilgan sanasi" oralig'i (Sana tanlagichi). */
  from: string;
  to: string;
  /** Birinchi darsga kelish sanasi (alohida yakka sana maydoni). */
  firstLessonDate: string;
  /**
   * Birinchi dars HAFTA KUNI ("Dushanba" …) — `day` dan farqi: u lid
   * YARATILGAN kunni oladi, bu esa birinchi darsga YOZILGAN kunni
   * (`firstLesson` dagi sana). 12.09.2026 da qo'shildi: moderator "shanba
   * kuni birinchi darsga keladiganlar" ro'yxatini bir bosishda oladi.
   */
  firstLessonDay: string;
}

export const EMPTY_ORDERS_FILTERS: OrdersFilters = {
  course: "", subcourse: "", group: "", teacher: "", moderator: "", status: "", status1: "",
  source: "", subsource: "", fromBranch: "", toBranch: "", day: "", survey: "", category: "",
  search: "", from: "", to: "", firstLessonDate: "", firstLessonDay: "",
};

function parseCreated(s: string): Date | null {
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

/** 1:1 port of applyOrdersFilters(), plus an added from/to date range
 * (the source's date-range popover exists in the HTML but was never wired
 * up to real filter logic — this replaces it with two functional inputs,
 * same treatment as the Tasks page's date range). */
export function applyOrdersFilters(items: Order[], f: OrdersFilters): Order[] {
  let res = items;
  if (f.course) res = res.filter((o) => o.course === f.course);
  if (f.subcourse) res = res.filter((o) => o.subcourse === f.subcourse);
  if (f.group) res = res.filter((o) => o.group === f.group);
  if (f.teacher) res = res.filter((o) => o.teacher === f.teacher);
  if (f.moderator) res = res.filter((o) => o.moderator === f.moderator);
  // "Status" — lid voronkasidagi BOSQICH (ORDER_STAGES), "Holatlar" esa
  // buyurtmaning o'z holati (STATUSES). Referensda ham shunday ikki xil.
  if (f.status) res = res.filter((o) => o.stage === f.status);
  if (f.status1) res = res.filter((o) => o.status === f.status1);
  if (f.source) res = res.filter((o) => o.source === f.source);
  if (f.subsource) res = res.filter((o) => o.subsource === f.subsource);
  if (f.fromBranch) res = res.filter((o) => o.fromBranch === f.fromBranch);
  if (f.toBranch) res = res.filter((o) => o.toBranch === f.toBranch);
  if (f.survey) res = res.filter((o) => o.survey === f.survey);
  if (f.category) res = res.filter((o) => o.category === f.category);

  if (f.day) {
    res = res.filter((o) => {
      const dt = parseCreated(o.created);
      return !!dt && WEEKDAY_NAMES[dt.getDay()] === f.day;
    });
  }

  if (f.from) {
    const fromDt = new Date(f.from);
    res = res.filter((o) => {
      const dt = parseCreated(o.created);
      return !!dt && dt >= fromDt;
    });
  }
  if (f.to) {
    const toDt = new Date(f.to + "T23:59:59");
    res = res.filter((o) => {
      const dt = parseCreated(o.created);
      return !!dt && dt <= toDt;
    });
  }

  if (f.firstLessonDate) {
    // `firstLesson` — "DD.MM.YYYY | HH:mm" ko'rinishida saqlanadi.
    const [y, m, d] = f.firstLessonDate.split("-");
    const wanted = `${d}.${m}.${y}`;
    res = res.filter((o) => (o.firstLesson || "").startsWith(wanted));
  }
  if (f.firstLessonDay) {
    // Birinchi dars sanasi bo'lmagan lid (hali yozilmagan) hech qaysi kunga
    // tushmaydi — `parseCreated` sanani "DD.MM.YYYY" boshidan oladi.
    res = res.filter((o) => {
      const dt = parseCreated(o.firstLesson || "");
      return !!dt && WEEKDAY_NAMES[dt.getDay()] === f.firstLessonDay;
    });
  }

  if (f.search) {
    const q = f.search.trim().toLowerCase();
    if (q) {
      res = res.filter((o) => {
        // Qidiruv buyurtmaning HAMMA ko'rinadigan maydoni bo'yicha: ism,
        // telefon, ID, kurs, guruh, o'qituvchi, moderator, holat, manba,
        // filial, kategoriya, izoh va h.k.
        const hay = [
          o.name, o.phone, String(o.id), String(orderNo(o)), o.course, o.subcourse, o.level,
          o.group, o.teacher, o.moderator, o.status, o.source, o.subsource,
          o.fromBranch, o.toBranch, o.category, o.survey, o.note,
          o.lessonDay, o.created, o.firstLesson,
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
  }
  return res;
}
