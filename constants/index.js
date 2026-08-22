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
