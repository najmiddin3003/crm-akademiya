import StudentWebApp from "@/components/student-web/StudentWebApp";

// O'quvchining shaxsiy kabineti — botdagi tugma Telegram ichida shu
// manzilni ochadi.
//
// SERVERDA HECH NARSA YUKLANMAYDI. Sahifa bo'sh qobiq: kim ekani faqat
// Telegram bergan `initData` dan bilinadi va u BRAUZERDA paydo bo'ladi.
// Serverda uni o'qib bo'lmaydi, shu bois ma'lumot klientdan
// /api/student-web/me ga so'rov bilan olinadi — imzo o'sha yerda
// tekshiriladi (lib/studentBot/webapp.ts).
//
// `(app)` GURUHIDAN TASHQARIDA, ataylab: u yerdagi layout CRM sessiyasini
// talab qiladi va sidebar/navbar chizadi. O'quvchida sessiya yo'q, CRM
// menyusi esa unga umuman ko'rinmasligi kerak.
export const metadata = {
  title: "Shaxsiy kabinet",
};

export default function Page() {
  return <StudentWebApp />;
}
