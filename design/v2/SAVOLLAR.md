# v2 — ochiq savollar

Yangi versiya ustida ishlash davomida yig'ilgan savollar. Foydalanuvchi bilan **oxirida
birga ko'rib chiqiladi** (17.10.2026 kelishuvi). Har savolda — hozircha qanday taxmin
bilan ishlanayotgani: javob kelguncha ish to'xtamaydi, javob boshqacha bo'lsa o'zgartiriladi.

Holat: **ochiq** — javob kutilmoqda · **hal qilindi** — javob va sana bilan.

---

## Dizayn tizimi

**1. Fanlarni ranglarga bog'lash** — ochiq
Dizaynda 8 ta fan rangi bor (Ingliz, Ona tili, Matematika, Rus, Arab, Biologiya, Tarix,
Boshqa), bazadagi kurslar esa ko'proq (Fizika, Kimyo, Nemis tili, IELTS, CEFR, SAT,
Prezident maktablari …).
*Taxmin:* nomi aniq mos kelgani — o'z rangi; IELTS / CEFR / SAT — «Ingliz tili» rangi;
qolgani — «Boshqa».

**2. Holatlar uchun och fon** — ochiq
«To'landi», «Qarz», «Muddat yaqin» kabi belgilarga och fon kerakmi? Hozir och fon faqat
brend uchun bor («Asosiy fon»).
*Taxmin:* kerak bo'lsa har holatga `-bg` token qo'shiladi (fan ranglari uslubida).

**3. Soyalarning aniq qiymatlari** — ochiq
Rasmda soya qiymati yozilmagan — piksellardan o'lchab, taxminiy qiymat yozildi.
Qorong'i temadagi soya dizaynda umuman ko'rsatilmagan.
*Taxmin:* o'lchangan qiymatlar; qorong'ida — qora, kuchliroq soya.

**4. Onest shriftini yuklash** — ochiq
Google'dan (`next/font/google`) yoki loyiha ichiga joylab (`next/font/local`)?
Serverda Google shriftlari build'ni bir necha marta yiqitgan.
*Taxmin:* loyiha ichiga joylanadi.

**5. Binafsha rang qayerda ishlatiladi** — qisman hal qilindi (komponentlar rasmidan)
Ikki joyda chiqdi: lid holati «Bog'lanildi» va «Ona tili» fan rangi (yorug'da). Boshqa
vazifasi bormi?
*Taxmin:* faqat shu ikki joyda.

**6. Shrift o'lchami sozlamasi** — ochiq
Hozirgi saytda foydalanuvchi shrift o'lchamini o'zgartira oladi. Yangi versiyada ham
ishlashi kerakmi?
*Taxmin:* ha — o'lchamlar `rem`da yozildi, sukut bo'yicha dizayndagi px bilan aynan bir xil.

**8. Lid holati nomi: «Birinchi darsga» yoki «Sinov darsiga yozildi»** — ochiq
Komponentlar rasmida «Birinchi darsga», hozirgi saytda va Telegram xabarlarida
«Sinov darsiga yozildi».
*Taxmin:* hozirgi nom qoladi (rasmdagisi namuna yozuv).

**9. Komponentlarning aniq o'lchamlari** — ochiq
Rasm ~0.6× kichraytirilgan: o'lchamlar ±2 px aniqlikda (maydon balandligi ~40, padding,
yorliq shrifti). Ranglar esa aniq. Dizayn tizimining manba fayli (HTML yoki Figma) bormi?
*Taxmin:* 4 px to'riga yaxlitlangan qiymatlar (maydon 40, tugma 32/36/40).

**10. Qorong'i temadagi grafik ranglari** — ochiq
Pul grafigi faqat yorug' temada ko'rsatilgan.
*Taxmin:* qorong'ida och pog'onalar (teal 400 / 300 / 500 / 700).

## Reja

**7. Yangi versiya qanday quriladi** — ochiq (foydalanuvchi tushuntiradi)
Dizayn manbasi (Figma / HTML / rasm), qaysi sahifalardan boshlanadi, yangi versiyani
avval kim ko'radi (adminlar yoki hamma).
