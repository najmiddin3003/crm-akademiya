// Sozlamalar → Sotuv va marketing → "So'raladigan bo'limlar".
// Referensda uchta mustaqil rejim bor: o'quvchi kartasi, buyurtma formasi va
// birinchi darsga keladiganlar formasi. Har bir rejimda qaysi maydon
// so'ralishi alohida yoqiladi.
//
// Holat MongoDB `settings` kolleksiyasida "sale-marketing.field" kaliti ostida
// { student: {...}, order: {...}, firstLesson: {...} } shaklida saqlanadi —
// bu yerda faqat yorliqlar va boshlang'ich qiymatlar.

export const STUDENT_FIELDS = [
  { key: "note", label: "Izoh", default: false },
  { key: "lastName", label: "Familiya", default: true },
  { key: "phone", label: "Telefon raqam", default: true },
  { key: "email", label: "Elektron pochta", default: false },
  { key: "photo", label: "Rasm", default: false },
  { key: "category", label: "Kategoriya", default: true },
  { key: "birthDate", label: "Tug'ilgan sana", default: true },
  { key: "survey", label: "So'rovnoma", default: false },
  { key: "lang", label: "Til", default: false },
  { key: "paymentDate", label: "To'lov sanasi", default: false },
  { key: "address", label: "Uy manzili", default: false },
  { key: "targetUniversity", label: "Maqsad qilgan universitet", default: false },
  { key: "organization", label: "Tashkilot", default: false },
  { key: "fatherName", label: "Otasining ismi", default: false },
  { key: "fatherPhone", label: "Otasining telefon raqami", default: true },
  { key: "fatherEmail", label: "Otasining elektron pochtasi", default: false },
  { key: "motherName", label: "Onasining ismi", default: false },
  { key: "motherPhone", label: "Onasining telefon raqami", default: false },
  { key: "motherEmail", label: "Onasining elektron pochtasi", default: false },
];

// Buyurtma va "birinchi darsga keladiganlar" formalari bir xil maydonlardan
// iborat, shuning uchun ro'yxat umumiy. Ammo referensda ular mustaqil
// sozlanadi — saqlashda ikkita alohida obyekt bo'ladi (pastdagi FIELD_MODES).
export const ORDER_FIELDS = [
  { key: "subCourse", label: "Subkurs", default: true },
  { key: "courseDays", label: "Kurs kunlari", default: true },
  { key: "courseTime", label: "Kurs vaqti", default: true },
  { key: "teacher", label: "O'qituvchi", default: true },
  { key: "group", label: "Guruh", default: true },
  { key: "firstLessonDate", label: "Birinchi darsga keladigan sanasi", default: true },
  { key: "note", label: "Izoh", default: true },
];

// Yuqoridagi rejim tugmalari shu tartibda chiqadi; `key` — saqlash obyektidagi
// bo'lim nomi.
export const FIELD_MODES = [
  { key: "student", label: "O'quvchi", fields: STUDENT_FIELDS },
  { key: "order", label: "Buyurtma", fields: ORDER_FIELDS },
  { key: "firstLesson", label: "Birinchi darsga keladiganlar", fields: ORDER_FIELDS },
];
