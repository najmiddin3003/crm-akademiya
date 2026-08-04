// Sotuv va marketing > SMS shablonlari uchun demo ma'lumot — referens
// saytdagi 3 ta shablon. Backend /api/sms-templates bo'sh kolleksiyani
// shundan seed qiladi.
export const SMS_TEMPLATE_SEED = [
  {
    id: 1,
    title: "Maktabga tayyorlov kursi",
    audience: "O'quvchi",
    text: "Hurmatli {name}, Akademiya o'quv markazida maktabga tayyorlov kursiga qabul boshlandi. Batafsil ma'lumot uchun bog'laning.",
  },
  {
    id: 2,
    title: "To'lov qiling",
    audience: "O'quvchi",
    text: "Hurmatli {name}. Sizning {group} guruhi bo'yicha {amount} so'm to'lovingiz kutilmoqda. Iltimos, {date} sanasigacha to'lovni amalga oshiring.",
  },
  {
    id: 3,
    title: "Sinov darsiga kelmaganda yuboriladigan sms",
    audience: "O'quvchi",
    text: "Assalomu alaykum {name}. Siz bugungi sinov darsiga tashrif buyurmadingiz. Yangi kunga yozilish uchun biz bilan bog'laning.",
  },
];
