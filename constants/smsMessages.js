// Sotuv va marketing > Xabarlar ro'yhati uchun demo ma'lumot manbasi.
// Backend /api/sms-messages bo'sh kolleksiyani deterministik tarzda seed
// qiladi (referensda 42 902 ta yozuv bor — bu yerda ancha kichik to'plam).
export const SM_RECIPIENTS = [
  "Jahongir Qochqarboyev",
  "Muhammadaliyev Oybek",
  "Gulsanam Alijanova",
  "Alijanov Jahongir",
  "Mashxura Najmiddinova",
  "Fazllidin Najmiddinov",
  "Motabar Yunusova",
  "Elomon Hayitaliyev",
  "Mavlanov Jahongir",
  "Xumoyinmirzo Sobithanov",
  "Muhammadzoyir Topatillayev",
  "Sarvinoz Tursunova",
  "Karimova Nilufar",
  "Rasulov Sardor",
];

export const SM_MODERATORS = [
  "NilufarSharipova",
  "DilmurodKomilov",
  "AbdullohRaxmatullayev",
  "",
];

// Xabar shablonlari — {name}/{amount} seed vaqtida almashtiriladi.
export const SM_BODIES = [
  {
    kind: "auto",
    text: "Assalomu alaykum {name}, Siz Akademiya o'quv markazida kelajagingiz uchun {amount} so'm sarmoya kiritdingiz!",
  },
  {
    kind: "manual",
    text: "Hurmatli {name}, {amount} so'm to'lovingiz qabul qilindi. Rahmat!",
  },
  {
    kind: "grouped",
    text: "Hurmatli {name}, ertangi dars jadvalida o'zgarish bor. Batafsil ma'lumot uchun administrator bilan bog'laning.",
  },
  {
    kind: "auto",
    text: "Assalomu alaykum {name}. Sizning obunangiz tugashiga oz qoldi. Iltimos, {amount} so'm to'lovni amalga oshiring.",
  },
];

export const SM_AMOUNTS = [100000, 125000, 175000, 237500, 250000, 300000, 400000, 600000];

export const SM_TOTAL = 120;
export const SM_DAYS = 30;
