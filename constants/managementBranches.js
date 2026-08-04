// Boshqaruv > Filiallar uchun demo ma'lumot — referens saytdagi 2 ta filial.
// Backend /api/branches bo'sh kolleksiyani shundan seed qiladi.
export const MANAGEMENT_BRANCH_SEED = [
  { id: 1, name: "Akademiya", location: "" },
  { id: 2, name: "Akademiya 2-filial", location: "Chortoq" },
];

// Filial nomlarining kanonik ro'yxati. Serverga so'rov yubora olmaydigan
// SINXRON joylar shundan foydalanadi (masalan lib/ordersData.ts demo
// generatori) — shunda ular /api/branches seed'i bilan bir xil nomlardan
// boshlaydi. Jonli UI ro'yxatlari esa to'g'ridan-to'g'ri /api/branches dan
// o'qishi kerak, chunki foydalanuvchi qo'shgan filiallar ham kerak bo'ladi.
export const MANAGEMENT_BRANCH_NAMES = MANAGEMENT_BRANCH_SEED.map((b) => b.name);
