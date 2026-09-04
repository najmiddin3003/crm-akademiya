// Umumiy ro'yxatlar.
//
// Bu yerda ilgari statik demo O'QUVCHILAR (STUDENTS, 50 ta + STUDENT_NAMES) va
// O'QITUVCHILAR (TEACHERS, 12 ta) massivlari turardi — ular olib tashlandi.
// Endi:
//   • o'quvchilar  → MongoDB `pupils`  → /api/pupils  (hooks/useStudents.ts,
//                    buyurtma paneli uchun components/orders/PupilsContext)
//   • o'qituvchilar → MongoDB `hr_employees` (turi: "teacher") → /api/teachers
//                    (hooks/useTeachers.ts)
// Ular bilan birga faqat o'sha ro'yxatlar uchun kerak bo'lgan yordamchi
// ro'yxatlar ham (STATUS_LABELS, COURSES, LEVELS, MODERATORS, WEEKDAYS)
// o'chirildi — ularning o'rniga ma'lumotning o'zidan hisoblanadigan tanlovlar
// ishlatiladi (masalan components/leads/FirstLessonsPage.tsx).
//
// Quyidagilar hali backendga ko'chirilmagan tanlov ro'yxatlari.

// Yig'ilayotgan guruhlar — buyurtma qo'shish formasidagi tegishli tanlov
// uchun demo ro'yxat (Guruh sahifasi o'zining /api/groups backendidan
// o'qiydi; bu tanlov hali unga ulanmagan).
export const GROUPS = [
  "Ingliz tili — 1-guruh (Dush/Chor/Juma, 09:00)",
  "Ingliz tili — 2-guruh (Sesh/Pay/Shan, 15:00)",
  "Arab tili — 1-guruh (Dush/Chor/Juma, 10:00)",
  "Rus tili — 1-guruh (Sesh/Pay, 14:00)",
  "Matematika — 1-guruh (Dush/Chor/Juma, 16:00)",
];

// O'quvchi qo'shish formasidagi "Kategoriyani tanlang".
export const STUDENT_CATEGORIES = ["Kichik (1-4-sinf)", "O'rta (5-9-sinf)", "Katta (10-sinf+)"];

// O'quvchi qo'shish formasidagi MAJBURIY "Manba" tanlovi — o'quvchi
// markazni qayerdan eshitgani. Qiymat `pupils.source` ga MATN bo'lib
// yoziladi va O'quvchilar ro'yxatida filtr (StudentsListPage "Manba"),
// jadval ustuni va Excel eksportida ishlatiladi.
//
// DIQQAT — "Tavsiya" satri AYNAN shu imloda qolsin: StudentsListPage
// dagi "Tavsiyalarni yuklash" tugmasi `r.source === "Tavsiya"` bo'yicha
// filtrlaydi. "Do'st tavsiyasi" yoki "Referal" deb yozilsa, tugma
// xatosiz, lekin DOIM BO'SH fayl beradi.
//
// Solishtiruv qat'iy tenglik bo'yicha ketadi (lib/studentsData.ts), shu
// bois qiymatlar barqaror bo'lishi kerak: bu yerda o'zgartirilsa eski
// yozuvlar yetim qoladi. Apostrof ataylab ishlatilmagan — qo'lda qayta
// yozilganda ' (U+0027) o'rniga ’ (U+2019) tushib, tenglik jimgina
// buzilishi mumkin.
// "Boshqa" — ro'yxatdagi oddiy variant EMAS, DARVOZA: tanlansa qo'shimcha
// oyna ochiladi va moderator manbani o'z so'zi bilan yozadi. Yozilgan matn
// `source` ga tushadi, ya'ni bazada "Boshqa" degan qiymat HECH QACHON
// saqlanmaydi — aks holda "Manba" filtri bir kunda ma'nosiz "Boshqa"
// to'plamiga aylanib qolardi.
export const SOURCE_OTHER = "Boshqa";

export const STUDENT_SOURCES = [
  "Instagram",
  "Telegram",
  "Facebook",
  "YouTube",
  "Veb-sayt",
  "Banner",
  "Tavsiya",
  SOURCE_OTHER,
];

// Lid (buyurtma) guruhga yozilganda o'quvchi AVTOMATIK yaratiladi
// (lib/enrollStudent.ts) — o'shanda manba shu qiymat bo'ladi.
// `STUDENT_SOURCES` ga ATAYLAB kirmaydi: buni qo'lda tanlashning ma'nosi
// yo'q, u tizim biladigan fakt. Filtrda o'zi paydo bo'ladi, chunki filtr
// varianti mavjud yozuvlardan quriladi.
export const SOURCE_FROM_ORDER = "Buyurtmadan";
