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

// DIQQAT: bu yerda "Fanlar" ro'yxati YO'Q va bo'lmasligi ham kerak.
// Ilgari BLOCK_TEST_SUBJECTS qattiq yozilgan 12 ta maktab fani edi va u
// akademiyaning haqiqiy kurslariga mos kelmasdi. Endi "Fan" tanlovi
// /api/offline-courses dan keladi (components/blockTest/BlockTestTypeModal.tsx).
//
// Shu bilan birga BLOCK_TEST_TYPE_SEED va BLOCK_TEST_EXAM_SEED ham
// o'chirildi: ikkalasi ham doimiy bo'sh massiv edi va hech qayerdan
// import qilinmasdi — turlar/imtihonlar /api/block-test-types va
// /api/block-test-exams dan keladi.
