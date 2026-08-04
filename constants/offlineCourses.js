// Oflayn kurslar (Offline Courses) demo ma'lumotlari.
// crm-akademiya/src/app.js dagi COURSES massividan (16 ta yozuv) ko'chirilgan.
// Backend hali yo'q — bu seed OfflineCoursesProvider ichida bir marta klonlanadi
// va sahifa yangilanguncha (reload) shu holatda ishlaydi. Har bir kursga
// `levels` (darajalar) maydoni qo'shildi — kurs tafsiloti (detail) sahifasidagi
// "Darajalar" tabi shu massivni ko'rsatadi/tahrirlaydi.
//
// Eslatma: constants/index.js dagi `COURSES` — bu boshqa narsa (kurs
// nomlarining oddiy string massivi, filtrlar uchun). Nom to'qnashmasligi uchun
// bu yerda `OFFLINE_COURSES` deb nomlangan.

// Filial ro'yxati bu yerda EMAS — qo'shish/tahrirlash formalari (CourseForm,
// LevelForm) hooks/useBranches.ts (/api/branches) dan oladi, Boshqaruv →
// Filiallar sahifasi bilan bir xil manba. Quyidagi seed'dagi `branches`
// massivlari esa demo kurslarning boshlang'ich narxlari — ular filial ID'lari
// bo'yicha mos keladi.

export const OFFLINE_COURSES = [
  { id: 1,  name: "Nemis tili",    color: "#4a6fa5", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 250000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 2,  name: "Turk tili",     color: "#dc2626", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 230000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 230000 }], levels: [] },
  { id: 3,  name: "Koreys tili",   color: "#ec9a9a", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 270000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 4,  name: "Rus tili",      color: "#10b981", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 250000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 270000 }], levels: [] },
  { id: 5,  name: "Ingliz tili",   color: "#e8b4b8", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 270000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 300000 }], levels: [] },
  { id: 6,  name: "Arab tili",     color: "#2563eb", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 250000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 7,  name: "Sertifikat",    color: "#7dd3fc", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 500000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 8,  name: "Maxsus maktab", color: "#ea580c", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 400000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 9,  name: "Ona tili",      color: "#22d3ee", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 200000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 200000 }], levels: [] },
  { id: 10, name: "Fizika",        color: "#a855f7", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 280000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 11, name: "Matematika",    color: "#f59e0b", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 280000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 280000 }], levels: [] },
  { id: 12, name: "Biologiya",     color: "#84cc16", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 260000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 13, name: "IELTS",         color: "#0ea5e9", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 450000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 450000 }], levels: [] },
  { id: 14, name: "Tarix",         color: "#78350f", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 240000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 15, name: "Geografiya",    color: "#d97706", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 240000 }, { id: 2, name: "Akademiya 2-filial", enabled: false, price: 0 }],      levels: [] },
  { id: 16, name: "Adabiyot",      color: "#be185d", branches: [{ id: 1, name: "Akademiya", enabled: true, price: 250000 }, { id: 2, name: "Akademiya 2-filial", enabled: true,  price: 250000 }], levels: [] },
];
