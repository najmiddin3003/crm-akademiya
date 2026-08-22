// Ported from crm-akademiya/src/app.js:
// _NAMES_F/_NAMES_L/_TEACHERS/_COURSES/_LEVELS/_MODS/_PREFIX (~line 267),
// _genPhone/_genDate (~line 276), buildOrders (~line 296),
// _augmentOrders (~line 23074), ORDER_STAGES + _augmentOrdersKanban (~line 24065),
// getPageButtons (~line 22910).

import { MANAGEMENT_BRANCH_NAMES } from "@/constants/managementBranches";

export type OrderStageKey = "bir_oylay" | "jaylang_e" | "rahmaaaat" | "ketdim";

export interface Order {
  id: number;
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
  stage: OrderStageKey;
  dayPattern: string;
  taskStatus: string;
  referral: string;
  lessonDay: string;
  lessonStartTime: string;
}

const NAMES_F = ["Hilola","Jahongir","Muattar","Saida","Aziza","Shahnoza","Maftuna","Ruxshona","Mushtariy","Bekzod","Aziz","Sevinch","Diyorbek","Karim","Madina","Nilufar","Zuhra","Vasila","Abdusamad","Samandar","Qosimjon","Asal","Tojixon","Gulasal","Nazokat","Davron","Odina","Dildora","Dilshoda","Feruza","Umida","Karomat","Azizbek","Bahodir","Sardor","Akmal","Jamol","Sherzod","Otabek","Jasur","Anvar","Sanjar","Murod","Rustam","Iroda","Zilola","Malika","Gulnoza","Dilfuza","Mohira","Sevara","Shaxnoza","Lola","Komila","Mehribon"];
const NAMES_L = ["Rahmatullayeva","Ahmadjanov","Yoldasheva","Mansurova","Olimova","Bahriddinova","Dedahanova","Tursunxojayeva","Mamadjanova","Jakbaraliyeva","Shodmanov","Rasulov","Karimov","Yusupova","Saidov","Ortiqova","Toshpo'latova","Mamadhanova","Turdaliyev","Muhammadjonov","Malikjanov","Bahodirjanova","Xolmirzayeva","Sobithanova","Sddiqova","Nasriddinova","Akmalova","Halimov","Orinboyeva","Ismoilova","Jumaboyeva","Abdulazizova","Akbaraliyeva","Karimjanova","Tumanova","Rahimjanov","Toshpolatov","Salimov","Rahmonov","Yusupov","Tursunov","Komilov","Saidova","Tashkentov","Buxoriy"];
// DIQQAT: bu ro'yxat TANLOV uchun emas. O'qituvchilar bazadan keladi
// (/api/teachers → MongoDB hr_employees, klientda hooks/useTeachers.ts).
// Quyidagi nomlar faqat eski demo buyurtmalar generatori (buildOrders, 502 ta
// soxta yozuv) qatorlarini to'ldirish uchun qolgan — hech bir forma yoki
// filtr bundan o'qimaydi.
const DEMO_ORDER_TEACHERS = ["Abdushukur Abdug'aniyev","Yaxyoxo'ja Yigitaliyev","Jasurbek O'rinboyev","Hasanboy Obidov","Sevinch Madaminova","Ilhomjon Sharabidinov","Gulbahor Jo'raboyeva","Jasurbek Komiljonov","Mahmud Toshmatov","Dilnoza Nabijanova","Rayxona To'lqinova","Musoxon Maxamadaliyev",""];
export const COURSES = ["Ingliz tili","Arab tili","Rus tili","Matematika","Fizika","Biologiya","Kimyo","Tarix","Turk tili"];
const LEVELS = ["1-bosqich","2-bosqich","3-bosqich","5-bosqich (CEFR / IELTS)","10 - 11 - sinf","7 - 9 - sinf","2 - bosqich (7-sinf+)","3 - bosqich (7-sinf+)","6-bosqich","Начальный (1-bosqich)",""];
export const MODERATORS = ["Dilmurod Komilov","Nilufar Sharipova","Abdulloh Raxmatullayev"];
const PREFIX = ["90","91","93","94","95","97","98","99","88"];

export const STATUSES = ["Yangi", "Qabul qilindi", "Kelmoqda", "Kutilmoqda", "Bekor qilindi", "Yakunlandi", "O'tkazildi"];
const SOURCES = ["Instagram", "Telegram", "Tanish", "Facebook", "YouTube", "Sayt"];
export const SUBSOURCES = ["Reklama", "Post", "Story", "Taklif", "Boshqa"];
// Filial nomlari Boshqaruv → Filiallar bilan BIR XIL manbadan
// (constants/managementBranches.js). Bu funksiya sinxron va klient
// komponentlaridan chaqiriladi, shuning uchun /api/branches dan o'qiy
// olmaydi — kanonik boshlang'ich ro'yxat ishlatiladi.
const BRANCHES = MANAGEMENT_BRANCH_NAMES;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function genPhone(seed: number): string {
  const prefix = PREFIX[seed % PREFIX.length];
  const n = (seed * 7919 + 13) % 10000000;
  const s = String(n).padStart(7, "0");
  return `${prefix} ${s.slice(0, 3)} ${s.slice(3, 5)} ${s.slice(5, 7)}`;
}

function genDate(seed: number, baseDays = 0): string {
  const d = new Date(2026, 4, 22);
  d.setDate(d.getDate() - baseDays - (seed * 2 + ((seed * 13) % 5)));
  const h = ((seed * 7) % 12) + 8;
  const m = (seed * 17) % 60;
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} | ${pad2(h)}:${pad2(m)}`;
}

interface RawOrder {
  id: number;
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
}

const SEED: RawOrder[] = [
  { id: 6013, name: "Hilola Rahmatullayeva", phone: "", created: "20.05.2026 | 17:54", firstLesson: "", teacher: "", course: "Ingliz tili", level: "", moderator: "", note: "", isNew: true },
  { id: 5822, name: "Jahongir Ahmadjanov", phone: "94 408 57 97", created: "08.04.2026 | 14:08", firstLesson: "", teacher: "Abdushukur Abdug'aniyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5819, name: "Muattar Yoldasheva", phone: "93 674 02 09", created: "08.04.2026 | 08:58", firstLesson: "", teacher: "Abdushukur Abdug'aniyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5807, name: "Saida Mansurova", phone: "94 382 87 88", created: "06.04.2026 | 15:33", firstLesson: "", teacher: "Abdushukur Abdug'aniyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5774, name: "Aziza Olimova", phone: "90 599 51 16", created: "31.03.2026 | 16:12", firstLesson: "", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5770, name: "Shahnoza Bahriddinova", phone: "95 391 65 60", created: "31.03.2026 | 15:44", firstLesson: "", teacher: "Jasurbek O'rinboyev", course: "Ingliz tili", level: "5-bosqich (CEFR / IELTS)", moderator: "Nilufar Sharipova", note: "" },
  { id: 5756, name: "Maftuna Dedahanova", phone: "93 308 45 08", created: "30.03.2026 | 12:43", firstLesson: "", teacher: "Hasanboy Obidov", course: "Biologiya", level: "", moderator: "Nilufar Sharipova", note: "0 dan yangi guruh" },
  { id: 5755, name: "Ruxshona Tursunxojayeva", phone: "93 441 18 06", created: "30.03.2026 | 12:42", firstLesson: "", teacher: "Hasanboy Obidov", course: "Biologiya", level: "", moderator: "Nilufar Sharipova", note: "0dan yangi guruhka" },
  { id: 5754, name: "Mushtariy Mamadjanova", phone: "94 557 26 89", created: "29.03.2026 | 15:52", firstLesson: "", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5753, name: "Aziza Jakbaraliyeva", phone: "97 571 01 55", created: "29.03.2026 | 15:47", firstLesson: "", teacher: "Yaxyoxo'ja Yigitaliyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5752, name: "Jasurbek Shodmanov", phone: "94 614 75 55", created: "29.03.2026 | 13:27", firstLesson: "", teacher: "Abdushukur Abdug'aniyev", course: "Arab tili", level: "1-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5751, name: "Bekzod Rasulov", phone: "90 123 45 67", created: "28.03.2026 | 11:14", firstLesson: "", teacher: "", course: "Matematika", level: "2-bosqich", moderator: "Nilufar Sharipova", note: "" },
  { id: 5740, name: "Aziz Karimov", phone: "91 234 56 78", created: "27.03.2026 | 09:32", firstLesson: "", teacher: "Mahmud Toshmatov", course: "Fizika", level: "3-bosqich", moderator: "Dilmurod Komilov", note: "" },
  { id: 5735, name: "Sevinch Yusupova", phone: "93 456 78 90", created: "26.03.2026 | 16:48", firstLesson: "", teacher: "", course: "Ingliz tili", level: "2-bosqich", moderator: "Nilufar Sharipova", note: "" },
  { id: 5728, name: "Diyorbek Saidov", phone: "94 567 89 01", created: "25.03.2026 | 14:25", firstLesson: "", teacher: "Hasanboy Obidov", course: "Biologiya", level: "1-bosqich", moderator: "Nilufar Sharipova", note: "" },
];

function buildOrders(total: number): RawOrder[] {
  const out = SEED.slice();
  for (let i = out.length; i < total; i++) {
    const f = NAMES_F[(i * 3 + 7) % NAMES_F.length];
    const l = NAMES_L[(i * 5 + 11) % NAMES_L.length];
    const t = DEMO_ORDER_TEACHERS[(i * 7) % DEMO_ORDER_TEACHERS.length];
    const c = COURSES[(i * 11 + 2) % COURSES.length];
    const lv = LEVELS[(i * 13) % LEVELS.length];
    const m = MODERATORS[(i * 17 + 3) % MODERATORS.length];
    const noPhone = i % 23 === 5;
    out.push({
      id: 5500 - (i - 15) * 7,
      name: `${f} ${l}`,
      phone: noPhone ? "" : genPhone(i),
      created: genDate(i, 55),
      firstLesson: "",
      teacher: t,
      course: c,
      level: lv,
      moderator: m,
      note: "",
    });
  }
  return out;
}

/** 1:1 port of _augmentOrders() + _augmentOrdersKanban()'s deterministic-by-index fields. */
function augment(raw: RawOrder, i: number): Order {
  const r = (i * 37 + 13) % 100;
  return {
    ...raw,
    group: "",
    status: STATUSES[i % STATUSES.length],
    source: SOURCES[i % SOURCES.length],
    subsource: SUBSOURCES[i % SUBSOURCES.length],
    fromBranch: BRANCHES[i % BRANCHES.length],
    // Ofset +1: ilgari +2 edi va ro'yxat 2 ta filialdan iborat bo'lganda
    // (i+2)%2 === i%2 — ya'ni "qayerdan" va "qayerga" doim bir xil filial
    // chiqardi. +1 har qanday uzunlikda (>=2) ikkalasini farqli qiladi.
    toBranch: BRANCHES[(i + 1) % BRANCHES.length],
    category: CATEGORIES[i % CATEGORIES.length],
    survey: SURVEYS[i % SURVEYS.length],
    subcourse: SUBCOURSES[i % SUBCOURSES.length],
    stage: r < 12 ? "bir_oylay" : "rahmaaaat",
    dayPattern: i % 2 === 0 ? "Juft kunlar" : "Toq kunlar",
    taskStatus: "Topshiriq yo'q",
    referral: "",
    lessonDay: "",
    lessonStartTime: "",
  };
}

export const ORDERS_TOTAL = 502;

export function createInitialOrders(): Order[] {
  return buildOrders(ORDERS_TOTAL).map(augment);
}

// Add/edit-order drawer (components/orders/AddOrderModal.tsx) form values +
// the pure Order-building logic. buildOrderFromValues runs server-side
// (app/api/orders/route.ts, POST) and applyOrderValues runs client-side
// (components/orders/OrdersContext.tsx, before PATCHing the merged order) —
// both shared so the field mapping is defined exactly once.
export interface NewOrderValues {
  studentName: string;
  phone: string;
  referral: string;
  course: string;
  lessonDay: string;
  lessonStartTime: string;
  teacher: string;
  group: string;
  firstLessonDate: string;
  firstLessonTime: string;
  note: string;
  /** Only set by the Kanban "Qo'shish" full-page flow (components/orders/AddOrderPage.tsx) — the
   * side-drawer flow (AddOrderModal.tsx) leaves these unset and gets the defaults below. */
  moderator?: string;
  stage?: OrderStageKey;
}

function firstLessonFromValues(values: NewOrderValues): string {
  return values.firstLessonDate
    ? `${values.firstLessonDate.split("-").reverse().join(".")}${values.firstLessonTime ? ` | ${values.firstLessonTime}` : ""}`
    : "";
}

export function buildOrderFromValues(nextId: number, values: NewOrderValues): Order {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const created = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    id: nextId,
    name: values.studentName,
    phone: values.phone,
    referral: values.referral,
    course: values.course,
    lessonDay: values.lessonDay,
    lessonStartTime: values.lessonStartTime,
    teacher: values.teacher,
    moderator: values.moderator ?? "",
    note: values.note,
    created,
    firstLesson: firstLessonFromValues(values),
    level: "",
    group: values.group,
    isNew: true,
    stage: values.stage ?? "bir_oylay",
    dayPattern: "Juft kunlar",
    taskStatus: "Topshiriq yo'q",
    status: "Yangi",
    source: "Sayt",
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
  from: string;
  to: string;
}

export const EMPTY_ORDERS_FILTERS: OrdersFilters = {
  course: "", subcourse: "", group: "", teacher: "", moderator: "", status: "", status1: "",
  source: "", subsource: "", fromBranch: "", toBranch: "", day: "", survey: "", category: "",
  search: "", from: "", to: "",
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
  if (f.status) res = res.filter((o) => o.status === f.status);
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

  if (f.search) {
    const q = f.search.trim().toLowerCase();
    if (q) {
      res = res.filter((o) => {
        const hay = [o.name, o.phone, String(o.id), o.course, o.teacher, o.moderator].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
  }
  return res;
}
