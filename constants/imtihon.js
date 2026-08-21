// Imtihon bo'limi — referens HTML'dagi "IMTIHON (Oylik imtihon) VIEW" va
// "UZBMB MODULI" bo'limlaridan ko'chirilgan sobit ma'lumotlar.
// Sidebar: Imtihon > Oylik imtihon | UzBMB, href /imtihon.
//
// Bu yerda faqat XOM ma'lumot turadi: ro'yxatlar va demo urug'lar (seed).
// Hisob-kitob (foiz, UzBMB ball) `lib/imtihon.ts` da.

export const IM_SUBJECTS = [
  "Matematika",
  "Ingliz tili",
  "Kimyo",
  "Biologiya",
  "Fizika",
  "Ona tili",
  "Rus tili",
  "Arab tili",
  "Tarix",
  "Koreys tili",
  "Turk tili",
];

export const IM_LEVELS = ["1-bosqich", "2-bosqich", "3-bosqich", "4-bosqich", "Kids", "Abituriyent"];

/** UzBMB majburiy fanlari — har biri 10 tadan savol. */
export const UB_MAJ = ["Ona tili", "Matematika", "O'zbekiston tarixi"];

/** UzBMB 1- va 2-blok uchun tanlanadigan asosiy fanlar. */
export const UB_MAIN_SUBJECTS = [
  "Matematika",
  "Fizika",
  "Kimyo",
  "Biologiya",
  "Ingliz tili",
  "Ona tili va adabiyot",
  "Tarix",
  "Huquq",
  "Geografiya",
  "Rus tili",
];

// Oylik imtihon demo urug'i: [ism, fan, bosqich, [[oy, savollar, to'g'ri], ...]]
export const MONTHLY_SEED_ROWS = [
  ["Avazxonov Asadbek", "Ingliz tili", "1-bosqich", [["2026-06", 25, 17], ["2026-07", 25, 19], ["2026-08", 25, 21]]],
  ["Zebiniso Akramjanova", "Ingliz tili", "1-bosqich", [["2026-06", 25, 20], ["2026-07", 25, 22], ["2026-08", 25, 23]]],
  ["Ruxshona Soliyeva", "Ingliz tili", "2-bosqich", [["2026-06", 30, 21], ["2026-07", 30, 24], ["2026-08", 30, 26]]],
  ["Madina Muhammadova", "Ingliz tili", "2-bosqich", [["2026-07", 30, 18], ["2026-08", 30, 22]]],
  ["Soliha Habibullayeva", "Ingliz tili", "3-bosqich", [["2026-06", 40, 33], ["2026-07", 40, 35], ["2026-08", 40, 37]]],
  ["Muhammadamin Dehqanov", "Matematika", "Abituriyent", [["2026-06", 30, 22], ["2026-07", 30, 25], ["2026-08", 30, 27]]],
  ["Roziya Fayzullayeva", "Matematika", "Abituriyent", [["2026-06", 30, 18], ["2026-07", 30, 21], ["2026-08", 30, 24]]],
  ["Akbarali Ilyasov", "Matematika", "1-bosqich", [["2026-07", 25, 15], ["2026-08", 25, 20]]],
  ["Sarvinoz Shodmonova", "Matematika", "1-bosqich", [["2026-06", 25, 19], ["2026-07", 25, 18], ["2026-08", 25, 22]]],
  ["Salohiddin Rahimjanov", "Kimyo", "Abituriyent", [["2026-06", 25, 21], ["2026-07", 25, 23], ["2026-08", 25, 24]]],
  ["Komiljanobva Mushtariybonu", "Kimyo", "Abituriyent", [["2026-06", 25, 16], ["2026-07", 25, 19], ["2026-08", 25, 21]]],
  ["Murodjon Maxammadjanov", "Kimyo", "2-bosqich", [["2026-07", 20, 12], ["2026-08", 20, 15]]],
  ["Abdulloh Xudayberdiyev", "Biologiya", "Abituriyent", [["2026-06", 30, 26], ["2026-07", 30, 27], ["2026-08", 30, 28]]],
  ["Maqsadjon Mamadaliyev", "Biologiya", "Abituriyent", [["2026-06", 30, 20], ["2026-07", 30, 22], ["2026-08", 30, 25]]],
  ["Azamjanova Muhtasar", "Biologiya", "1-bosqich", [["2026-07", 25, 14], ["2026-08", 25, 17]]],
  ["Azamjanov Nomonxon", "Fizika", "2-bosqich", [["2026-06", 20, 13], ["2026-07", 20, 15], ["2026-08", 20, 16]]],
  ["Sadriqulova Guldona", "Ona tili", "1-bosqich", [["2026-07", 25, 21], ["2026-08", 25, 23]]],
  ["Alisherov Jasurbek", "Rus tili", "1-bosqich", [["2026-06", 20, 11], ["2026-07", 20, 13], ["2026-08", 20, 15]]],
  ["Soliyev Azizbek", "Arab tili", "1-bosqich", [["2026-07", 25, 20], ["2026-08", 25, 22]]],
  ["Muhammadjanov Muhammadiyor", "Tarix", "Abituriyent", [["2026-06", 30, 24], ["2026-07", 30, 26], ["2026-08", 30, 25]]],
];

// UzBMB demo urug'i: [ism, 1-blok fani, to'g'ri, 2-blok fani, to'g'ri, ona tili, matematika, tarix, oy]
export const UZBMB_SEED_ROWS = [
  ["Muhammadamin Dehqanov", "Matematika", 24, "Fizika", 22, 7, 9, 6, "2026-07"],
  ["Muhammadamin Dehqanov", "Matematika", 26, "Fizika", 24, 8, 9, 7, "2026-08"],
  ["Roziya Fayzullayeva", "Matematika", 22, "Fizika", 20, 7, 8, 6, "2026-08"],
  ["Salohiddin Rahimjanov", "Kimyo", 25, "Biologiya", 23, 8, 7, 8, "2026-07"],
  ["Salohiddin Rahimjanov", "Kimyo", 27, "Biologiya", 25, 9, 7, 8, "2026-08"],
  ["Abdulloh Xudayberdiyev", "Biologiya", 28, "Kimyo", 24, 8, 8, 9, "2026-08"],
  ["Komiljanobva Mushtariybonu", "Kimyo", 21, "Biologiya", 19, 6, 7, 7, "2026-08"],
  ["Soliha Habibullayeva", "Ingliz tili", 28, "Ona tili va adabiyot", 26, 9, 6, 8, "2026-08"],
  ["Maqsadjon Mamadaliyev", "Biologiya", 23, "Kimyo", 20, 7, 6, 7, "2026-08"],
  ["Muhammadjanov Muhammadiyor", "Tarix", 25, "Ona tili va adabiyot", 24, 8, 7, 9, "2026-08"],
  ["Sarvinoz Shodmonova", "Matematika", 19, "Fizika", 16, 6, 7, 5, "2026-08"],
];

// Sertifikat namunasi: Ingliz tili milliy sertifikati — 1-blok balli qo'lda
// kiritiladi (savol soni emas, to'g'ridan-to'g'ri 93 balldan).
export const UZBMB_CERT_SEED = {
  student: "Dilnoza Olimova",
  b1s: "Ingliz tili",
  b1cert: true,
  b1m: 93,
  b1c: null,
  b2s: "Ona tili va adabiyot",
  b2c: 23,
  m1: 8,
  m2: 7,
  m3: 8,
  month: "2026-08",
};
