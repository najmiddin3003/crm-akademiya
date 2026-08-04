// Guruh (Groups) demo ma'lumotlari — crm-akademiya/src/app.js buildGroups() dan.
// 12 ta hardcoded (skrinshotdagi kabi) + deterministik generator = 91 ta.
// `highlighted` — bugun davomat qilinmagan guruh (jadvalda SARIQ ko'rinadi).
// `periodExpired` — muddati o'tgan "Guruh vaqti" (QIZIL pill ko'rinadi).
// Backend `/api/groups` bo'sh kolleksiyani shu massivdan seed qiladi.

export const GROUP_STATUSES = [
  { key: "active", label: "Aktiv" },
  { key: "new", label: "Yangi" },
  { key: "frozen", label: "Muzlatilgan" },
  { key: "completing", label: "Yakunlanyapti" },
  { key: "finished", label: "Yakunlangan" },
  { key: "problematic", label: "Muammoli" },
];

export const GROUP_COURSES = ["Ingliz tili", "Arab tili", "Rus tili", "Matematika", "Fizika", "Biologiya", "Kimyo", "Tarix", "Ona tili"];
export const GROUP_EDU_TYPES = ["1-bosqich", "2-bosqich", "3-bosqich", "4-bosqich", "5-bosqich (CEFR / IELTS)", "Kids 2"];
// Ta'lim turi (format) — daraja (bosqich) dan alohida.
export const GROUP_FORMATS = ["Oflayn", "Onlayn"];
// Topshiriq/vazifa turlari (Barcha vazifalar + guruh Topshiriqlar).
export const TASK_TYPES = ["Imtihon", "Vazifa", "Manba", "Test", "Loyiha"];
export const GROUP_DAYS = ["Toq kunlar", "Juft kunlar", "Hafta kunlari", "Ya,Ch", "Ya,Pa", "Chor", "Du,Ju", "Se,Sh"];
export const GROUP_TIMES = ["06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00"];
export const GROUP_TEACHERS = [
  "Jasurbek O'rinboyev", "Mohinur Abdurahimova", "Odina Ahmedova", "Odina Yuldasheva",
  "Musoxon Maxamadaliyev", "Abdushukur Abdug'aniyev", "Shahnoza Abduqahharova",
  "Zebunniso Kukibayeva", "Azizbek Mahmudov", "Ibrohim Dadaxojayev",
];
export const GROUP_ROOMS = (() => {
  const arr = [];
  for (let n = 201; n <= 219; n++) if (n !== 215) arr.push(`${n} - xona`);
  return arr;
})();

const SEED12 = [
  { id: 36,  course: "Ona tili",    level: "",         day: "Toq kunlar",  time: "06:00 - 08:00", period: "03.09.2025 - 03.09.2026", periodExpired: false, students: 10, teacher: "Shahnoza Abduqahharova", room: "214 - xona", status: "active", highlighted: true },
  { id: 104, course: "Arab tili",   level: "1-bosqich", day: "Ya,Ch",       time: "06:00 - 08:00", period: "15.09.2025 - 15.11.2025", periodExpired: true,  students: 15, teacher: "Abdushukur Abdug'aniyev", room: "219 - xona", status: "active", highlighted: false },
  { id: 13,  course: "Matematika",  level: "",         day: "Toq kunlar",  time: "08:00 - 10:00", period: "02.09.2025 - 02.09.2026", periodExpired: false, students: 7,  teacher: "Mohinur Abdurahimova",  room: "201 - xona", status: "active", highlighted: true },
  { id: 14,  course: "Arab tili",   level: "1-bosqich", day: "Ya,Pa",       time: "08:00 - 10:00", period: "02.09.2025 - 02.09.2026", periodExpired: false, students: 13, teacher: "Musoxon Maxamadaliyev",  room: "203 - xona", status: "active", highlighted: false },
  { id: 31,  course: "Ingliz tili", level: "1-bosqich", day: "Juft kunlar", time: "08:00 - 10:00", period: "03.09.2025 - 03.09.2026", periodExpired: false, students: 13, teacher: "Odina Yuldasheva",       room: "211 - xona", status: "active", highlighted: false },
  { id: 57,  course: "Ingliz tili", level: "3-bosqich", day: "Juft kunlar", time: "08:00 - 10:00", period: "07.09.2025 - 07.09.2026", periodExpired: false, students: 3,  teacher: "Zebunniso Kukibayeva",   room: "205 - xona", status: "active", highlighted: false },
  { id: 87,  course: "Arab tili",   level: "4-bosqich", day: "Chor",        time: "08:00 - 10:00", period: "09.03.2025 - 09.03.2026", periodExpired: true,  students: 5,  teacher: "Abdushukur Abdug'aniyev", room: "219 - xona", status: "active", highlighted: false },
  { id: 80,  course: "Matematika",  level: "",         day: "Toq kunlar",  time: "08:00 - 10:00", period: "03.09.2025 - 03.09.2026", periodExpired: false, students: 9,  teacher: "Azizbek Mahmudov",       room: "216 - xona", status: "active", highlighted: true },
  { id: 5,   course: "Biologiya",   level: "",         day: "Toq kunlar",  time: "08:00 - 10:00", period: "03.09.2025 - 03.09.2026", periodExpired: false, students: 18, teacher: "Ibrohim Dadaxojayev",    room: "210 - xona", status: "active", highlighted: true },
  { id: 38,  course: "Rus tili",    level: "1-bosqich", day: "Toq kunlar",  time: "08:00 - 10:00", period: "03.06.2025 - 03.06.2026", periodExpired: true,  students: 6,  teacher: "Odina Ahmedova",         room: "202 - xona", status: "active", highlighted: true },
  { id: 37,  course: "Ingliz tili", level: "Kids 2",   day: "Toq kunlar",  time: "08:00 - 10:00", period: "10.09.2025 - 10.11.2026", periodExpired: false, students: 11, teacher: "Odina Yuldasheva",       room: "211 - xona", status: "active", highlighted: true },
  { id: 9,   course: "Ingliz tili", level: "1-bosqich", day: "Juft kunlar", time: "08:00 - 10:00", period: "02.06.2026 - 02.06.2027", periodExpired: false, students: 24, teacher: "Jasurbek O'rinboyev",    room: "208 - xona", status: "active", highlighted: false },
];

function buildGroups(total) {
  const out = SEED12.map((g) => ({ ...g, name: String(g.id), telegram: null }));
  const usedIds = new Set(out.map((g) => g.id));
  let nextId = 110;
  for (let i = out.length; i < total; i++) {
    let h = (i * 2654435761) % 2 ** 31;
    h = Math.abs(h);
    while (usedIds.has(nextId)) nextId += 1;
    const id = nextId;
    usedIds.add(id);
    nextId += 3;
    const sd = (h % 28) + 1;
    const sm = (h >>> 2) % 12;
    const ed = ((h >>> 4) % 28) + 1;
    const em = (h >>> 6) % 12;
    const expired = i % 13 === 7;
    out.push({
      id,
      name: String(id),
      course: GROUP_COURSES[h % GROUP_COURSES.length],
      level: GROUP_EDU_TYPES[(h >>> 3) % GROUP_EDU_TYPES.length],
      day: GROUP_DAYS[(h >>> 5) % GROUP_DAYS.length],
      time: GROUP_TIMES[(h >>> 7) % GROUP_TIMES.length],
      period: `${String(sd).padStart(2, "0")}.${String(sm + 1).padStart(2, "0")}.2025 - ${String(ed).padStart(2, "0")}.${String(em + 1).padStart(2, "0")}.2026`,
      periodExpired: expired,
      students: (h >>> 9) % 25,
      teacher: GROUP_TEACHERS[(h >>> 11) % GROUP_TEACHERS.length],
      room: GROUP_ROOMS[(h >>> 13) % GROUP_ROOMS.length],
      telegram: null,
      status: "active",
      highlighted: i % 4 === 0,
    });
  }
  return out;
}

export const GROUP_SEED = buildGroups(91);
