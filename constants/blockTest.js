// Blok test bo'limi uchun konstantalar (referens akademiya.edutizim.uz —
// "Tur qo'shish" formasidagi "Turi (kodi)" tanlovi aynan shu 8 ta band).
export const BLOCK_TEST_KINDS = [
  { value: "haftalik", label: "Haftalik" },
  { value: "oylik", label: "Oylik" },
  { value: "choraklik", label: "Choraklik" },
  { value: "sinov", label: "Sinov (mock)" },
  { value: "mavzu", label: "Mavzu bo'yicha" },
  { value: "kirish", label: "Kirish" },
  { value: "chiqish", label: "Chiqish" },
  { value: "boshqa", label: "Boshqa" },
];

// "Fanlar" ro'yxatidagi "Fan" tanlovi — referensda dinamik ro'yxatdan keladi,
// bu yerda odatiy maktab fanlari bilan seed qilindi (Sozlamalar bo'limidagi
// boshqa ro'yxatlar kabi keyinchalik kengaytirilishi mumkin).
export const BLOCK_TEST_SUBJECTS = [
  "Matematika",
  "Ona tili",
  "Adabiyot",
  "Ingliz tili",
  "Rus tili",
  "Fizika",
  "Kimyo",
  "Biologiya",
  "Tarix",
  "Geografiya",
  "Informatika",
  "Chizmachilik",
];

// Referensda hozircha bo'sh ("Umumiy soni: 0") — boshlang'ich seed bo'sh.
export const BLOCK_TEST_TYPE_SEED = [];
export const BLOCK_TEST_EXAM_SEED = [];
