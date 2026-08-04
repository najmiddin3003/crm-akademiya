// Boshqaruv > Rollar uchun demo ma'lumot — referens saytdagi 5 ta rol.
// Backend /api/roles bo'sh kolleksiyani shundan seed qiladi.
//
// "Administrator" referensda "Adminstrator" deb xato yozilgan — bu yerda
// to'g'ri yozuv ishlatiladi, chunki sahifadagi "Xodimlar" ustuni rol nomini
// constants/employees.js dagi ROLE_LABELS bilan solishtiradi; xato yozuvda
// hech qachon mos kelmay, hisob doim 0 chiqardi.
export const ROLE_SEED = [
  { id: 1, name: "IT", description: "It-school web developer" },
  { id: 2, name: "Nazorotchi", description: "tozalov va tartibga mas'ul" },
  { id: 3, name: "O'qituvchi", description: "ustoz" },
  { id: 4, name: "Administrator", description: "O'quvchi qabul qiladi" },
  { id: 5, name: "Filial direktori", description: "Faqat bitta filialni ko'rib boshqaradi" },
];
