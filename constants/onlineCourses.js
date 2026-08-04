// O'quv bo'limi → Onlayn kurs (crm-akademiya #view-online-courses,
// sidebar: O'quv bo'limi > Onlayn kurs, href /online-courses). Manbadagi
// ONLINE_COURSES massivi 1:1 — barcha 4 ta seed yozuv `published: false`
// (manbada ham shunday, shuning uchun "Aktiv kurslar" tabi bo'sh boshlanadi,
// "Yakunlanmagan kurslar" tabida 4 tasi ko'rinadi).

export const ONLINE_COURSES = [
  { id: 1, name: "test", description: "Test kursi tavsifi", what: "", price: 0, free: true, published: false, sections: [], cover: "icons" },
  { id: 2, name: "test", description: "Online course test", what: "", price: 0, free: true, published: false, sections: [], cover: "cosmic" },
  { id: 3, name: "wd", description: "Sovg'alar tizimi haqida kurs", what: "", price: 250000, free: false, published: false, sections: [], cover: "gifts" },
  { id: 4, name: "WDQ", description: "Bizning 3-filialimiz ochildi", what: "", price: 150000, free: false, published: false, sections: [], cover: "three" },
];
