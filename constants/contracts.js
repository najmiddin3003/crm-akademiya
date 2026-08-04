// O'quv bo'limi → Shartnoma (shartnoma andozalari). Backend /api/contracts
// bo'sh kolleksiyani shu massivdan seed qiladi.

// Shartnoma turi — hozircha manbada faqat "O'quvchi" ko'rsatilgan (value
// "student" jadvalning SHARTNOMA TURI ustunida xuddi shunday ko'rinadi).
export const CONTRACT_TYPES = [{ value: "student", label: "O'quvchi" }];

// Har bir shartnoma turi uchun tahrirlovchida ko'rsatiladigan "birlashtirish
// maydonlari" (mail-merge) — nusxalash tugmasi bosilganda {{token}} ko'rinishida
// klipbordga nusxalanadi, keyin matn ichiga joylashtiriladi.
export const CONTRACT_FIELDS = {
  student: [
    { label: "Ism", token: "ism" },
    { label: "Familiya", token: "familiya" },
    { label: "Telefon raqami", token: "telefon" },
    { label: "Email", token: "email" },
    { label: "Kategoriya ID", token: "kategoriya_id" },
    { label: "Tug'ilgan sana", token: "tugilgan_sana" },
    { label: "So'rov ID", token: "sorov_id" },
    { label: "Dars turi", token: "dars_turi" },
    { label: "Til", token: "til" },
    { label: "Takliflar soni", token: "takliflar_soni" },
    { label: "To'lov sanasi", token: "tolov_sanasi" },
    { label: "Teg ID lari", token: "teg_idlari" },
    { label: "keys.ofertaAcceptances", token: "keys.ofertaAcceptances" },
    { label: "Otasining ismi", token: "otasining_ismi" },
    { label: "Onasining ismi", token: "onasining_ismi" },
    { label: "Otasining telefon raqami", token: "otasining_telefon" },
    { label: "Onasining telefon raqami", token: "onasining_telefon" },
  ],
};

export const CONTRACT_SEED = [
  { id: 1, title: "test sarlavha", type: "student", content: "<p></p>", createdAt: "15.07.2026" },
];
