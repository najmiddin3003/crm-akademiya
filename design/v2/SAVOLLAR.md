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

**2. Holatlar uchun och fon** — hal qilindi (17.10, «Holat belgilari» rasmlaridan)
Kerak ekan: har holatning och foni rasmda bor — 5 ta `-bg` token, ikkala tema aniq o'lchangan.

**3. Soyalarning aniq qiymatlari** — ochiq (qisman)
Rasmlarda soya qiymati yozilmagan — ikkala temada piksellardan o'lchab, taxminiy model
yozildi (qorong'ida soya qora, menyu/oyna ostida ~40% → ~19 px gacha so'nadi).
*Taxmin:* o'lchangan qiymatlar; dizaynerdan aniq qiymat kelsa almashtiriladi.

**4. Onest shriftini yuklash** — ochiq
Google'dan (`next/font/google`) yoki loyiha ichiga joylab (`next/font/local`)?
Serverda Google shriftlari build'ni bir necha marta yiqitgan.
*Taxmin:* loyiha ichiga joylanadi. *Hozircha (17.10):* yangi qobiq Onest'ni brauzerda
Google Fonts'dan yuklaydi — faqat yangi versiyani tanlaganlarda, build'ga ta'sir qilmaydi.

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

**10. Qorong'i temadagi grafik ranglari** — hal qilindi (17.10, qorong'i komponentlar rasmidan)
Ikkala temada bir xil: teal 600 / 400 / 300 / 200. (Mening taxminim — boshqa pog'onalar — noto'g'ri edi.)

**11. Qorong'i temada holat belgilari, hover va skelet** — hal qilindi (17.10, qorong'i rasmlardan)
Hammasi aniq o'lchandi: holat fonlari (info `#132241` … xavf `#331715`), hover `#1C2127`
(taxmin to'g'ri chiqdi), skelet `#1F242A`. Qo'shimcha topilma: qorong'ida tugma ustidagi
matn har tugmada o'z to'q tusida — `on-brand` va `on-danger` tokenlari qo'shildi.

**12. Jadval sarlavhasi qotishi** — ochiq
Hozirgi saytda hamma jadvallarning sarlavhasi scroll paytida tepada qotib turadi.
Yangi dizaynda ham shundaymi?
*Taxmin:* ha, qotadi (ishlatuvchilar o'rganib qolgan).

## Navigatsiya (yon menyu rasmidan)

**13. «Rahbar paneli» — nima?** — ochiq
Yangi menyuda birinchi band, hozirgi saytda bunday bo'lim yo'q.
*Taxmin:* rahbar uchun umumiy ko'rsatkichlar sahifasi (filiallar, tushum, lidlar, davomat);
dizayni kelganda quriladi. Hozirgi yangi menyuda hali YO'Q (sahifasi yo'q band qo'yilmadi).

**14. «Blok test» yangi menyuda yo'q** — qisman hal qilindi (17.10)
Hozirgi saytda ham menyudan olib turilgan — 05.09.2026 dan markaz so'rovi bilan yashirin
(`constants/sidebar.js` → `hidden: true`). Dizayndagi yo'qligi shundan. Yangi menyu ham shu
bayroqqa bo'ysunadi: qaytarilsa «O'quv jarayoni» bo'limida, Imtihondan keyin chiqadi.

**15. Moliya ichida faqat 4 band** — ochiq
Rasmda: Kassalar, Kirim-chiqim, Kunlik topshiruv, Shartnomalar. Hozir Moliyada 15 band bor
(Bonus, Jarima, Oylik chiqarish, Tushum rejasi, Moliya analitikasi, P&L, Pul oqimi,
Tranzaksiyalar, Rejalashtirilgan xarajatlar, Sinxronizatsiya …).
*Taxmin:* rasm qisqartirilgan — hammasi Moliya ichida qoladi. **«Kunlik topshiruv»** —
yangi sahifa (nima ekanini tushuntirish kerak).

**16. «Lidlar 29» — son nimani sanaydi?** — ochiq
*Taxmin:* hali ishlanmagan (yangi) lidlar soni — bildirishnoma kabi. Bunday sanoq hozir
serverda yo'q (`/api/sidebar-counts` hamma lidlarni sanaydi), shu bois yangi menyuda son
hozircha ichki bandlarda: «Lidlar ro'yxati 29», «Birinchi darsga… 7» — eski menyudagidek.

**17. Filial tanlovi yon menyuga ko'chadi** — ochiq
Hozir yuqori panelda. Yangi versiyada yuqori paneldan olib tashlanadimi?
*Taxmin:* ha, faqat menyuda; Chortoq (1+2) bitta qator bo'lib qoladi.

**18. Til tanlash va kun/tun rejimi qayerda?** — ochiq (yuqori panel rasmidan)
Hozir yuqori panelda alohida tugmalar; yangi panelda yo'q.
*Taxmin:* profil menyusiga (avatar ⌄) ko'chadi.

**19. «Yangiliklar» (karnay) qayerda?** — ochiq
*Taxmin:* bildirishnomalar ichida alohida bo'lim bo'ladi.

**20. «Orqaga» tugmasi** — ochiq
Hozir yuqori panelda bor, yangisida yo'q.
*Taxmin:* olib tashlanadi — brauzerning «orqaga» tugmasi va yon menyu yetadi.

**21. MohirAI suzuvchi tugmasi** — ochiq
Hozir pastda robot tugma; yangi versiyada yuqori paneldagi «MohirAI».
*Taxmin:* suzuvchi tugma olib tashlanadi, AI paneli shu tugmadan ochiladi. Yangi qobiqda
shunday qilindi (17.10).

**25. Global qidiruv: guruh va xodim** — ochiq (yuqori panel)
Dizayndagi yozuv «O'quvchi, guruh yoki xodimni qidiring», hozirgi qidiruv esa faqat
o'quvchilarni topadi (ism, telefon, ID). Eski qidiruvdagi «Buyurtma» natijalari soxta
(demo generator) edi — yangi panelda ko'rsatilmaydi.
*Taxmin:* guruh va xodim qidiruvi qo'shilgach dizayndagi yozuv qo'yiladi; hozircha maydonda
«O'quvchini qidiring: ism, telefon yoki ID» — topa olmaydigan narsani va'da qilmasin.

**26. «Texnik yordam» qayerga olib boradi?** — ochiq (yon menyu)
Eski menyudagi «TEXNIK YORDAM» tugmasi hech narsa qilmaydi.
*Taxmin:* yordam guruhi yoki administrator Telegram'iga havola; manzil kelguncha yangi
menyuda ko'rsatilmaydi (bosilmaydigan tugma bo'lmasin).

## Sahifalar

**22. Filtrning ikki ko'rinishi — qayerda qaysi biri?** — ochiq (O'quvchilar sahifasi rasmidan)
Lidlar: bitta «Filtr» tugmasi, hammasi panelda. O'quvchilar: 3 ta asosiy filtr tepada +
«Yana filtrlar».
*Taxmin:* filtri ko'p sahifalarda (o'quvchilar, to'lovlar, guruhlar, xodimlar) — asosiy filtrlar
tepada + «Yana filtrlar»; filtri kam sahifalarda — bitta «Filtr» tugmasi.

**23. «Ustunlar» tanlovi saqlanadimi?** — ochiq
*Taxmin:* ha — har foydalanuvchining brauzerida, keyingi safar o'sha ustunlar ochiladi.

**24. Xulosa qatoridagi «Haqdorlik»** — ochiq
«Qarzdorlik» yonida turibdi (rasmda kesilgan).
*Taxmin:* oldindan to'lagan o'quvchilarning ortiqcha balansi yig'indisi.

*O'quvchilar ro'yxati qurildi (18.10.2026, `components/v2/students/StudentsListV2.tsx`).
Rasmda «Yana filtrlar» oynasi jadvalning o'rtasini yopib turgani uchun quyidagilar taxmin:*

**29. Jadvalda sukut bo'yicha qaysi ustunlar?** — qisman hal qilindi (18.10, tezkor panel rasmida
jadval boshi: O'quvchi → Guruh → O'qituvchi)
*Taxmin:* O'quvchi (doim), Guruh, O'qituvchi, Balans, Tanga, Holati, Qo'shilgan; «Ustunlar» orqali
yana ID, Manba, Moderator, Kategoriya. 1366 px noutbukda yon menyu ochiq turganda gorizontal
aylantirishsiz sig'adi (o'lchandi). Sukut o'zgargani uchun saqlangan tanlovlar qayta boshlandi.

**30. Ma'lumoti yo'q ustunlar** — ochiq
Eski jadvaldagi «To'lov sanasi», «Taklif qilganlari», «Ilovani yuklab olish sanasi»,
«Shartnoma», «Kelmagan davri» uchun o'quvchi yozuvida maydon yo'q — ular doim «—» turardi.
*Taxmin:* yangi jadvalda ko'rsatilmaydi; ma'lumoti paydo bo'lsa «Ustunlar» ga qo'shiladi.

**31. «Export» va «⋯» ichida nima?** — ochiq
*Taxmin:* «Export» — Excel va CSV (belgilangan qator bo'lsa — faqat ular); «⋯» — «Tavsiya
orqali kelganlar» (CSV). Eski «Import» bandi hech narsa qilmasdi — yangisida yo'q.

**32. Ro'yxatning sukut tartibi** — ochiq
*Taxmin:* «Qo'shilgan ↓» — yangi o'quvchi tepada; O'quvchi, Balans, Tanga va Qo'shilgan
sarlavhasi bosilsa saralanadi.

**33. «Yana filtrlar» qachon qo'llanadi?** — ochiq
*Taxmin:* faqat «Qo'llash» bosilganda (DESIGN → «Filtr paneli»); «Tozalash» faqat oynadagi
qoralamani bo'shatadi. Qo'llangan qo'shimcha filtrlar filtr qatori ostida chip bo'lib turadi
(× bilan) va tugmada soni chiqadi. Kurs / Guruh / Holati — darhol qo'llanadi.

**34. «Holati» — alohida ustunmi?** — ochiq
Eski jadvalda holat faqat ism yonida nishon edi («Aktiv» — nishonsiz).
*Taxmin:* alohida ustun, holat belgisi bilan: Aktiv — muvaffaqiyat, Muzlatilgan — ma'lumot,
Arxiv — betaraf; sabab — sichqoncha ostida.

**35. «Guruhlar» ustunida fan rangi** — qisman hal qilindi (18.10, «O'quvchi · Tezkor panel» rasmida
jadval boshi ko'rindi: O'quvchi → Guruh → O'qituvchi)
Endi «Guruh» ustuni kurs nomini fan rangidagi nuqta bilan ko'rsatadi (bir nechta guruh — «+N»),
«O'qituvchi» sukutda yoqiq; ID va Manba sukutda o'chiq («Ustunlar» da bor), «Kurs» ustuni olib
tashlandi (Guruh uni ko'rsatadi).
*Taxmin:* kurs → fan nomdan aniqlanadi: ingliz/english/IELTS/CEFR → Ingliz, «ona tili»/«adabiyot» →
Ona tili, matem → Matematika, rus, arab, bio, tarix; qolgani — «Boshqa».

*O'quvchi tezkor paneli qurildi (18.10.2026, `components/v2/students/StudentQuickPanel.tsx`):*

**36. «Yangi o'quvchi» belgisi qachon?** — ochiq
Bazada o'quvchi holati faqat Aktiv / Muzlatilgan / Arxiv; «Yangi o'quvchilar» bo'limi esa
o'quvchilar emas — «Yangi» holatidagi lidlar.
*Taxmin:* faol, lekin hali bir marta ham to'lamagan o'quvchi (balansi 0) — rasmda ham «Hali to'lov
qilinmagan» bilan birga turibdi. Qolganlari — o'z holati.

**37. «Tarix» qayerdan?** — ochiq
Profildagi «Harakatlar tarixi» manbasi (`pupil_activity`) hech qachon yozilmaydi — u doim bo'sh.
*Taxmin:* bor ma'lumotdan yig'iladi: guruhga qo'shilgan kuni (a'zolik tarixi), holat o'zgarishi
(oxirgisi, sababi bilan), ro'yxatga olingan kun va manba. Rasmdagi «Lid qo'shildi» o'rniga
«O'quvchi qo'shildi» — o'quvchi yozuvida lidga havola yo'q, lid sahifasi bu bo'limga yopiq.
To'liq harakatlar jurnali kerak bo'lsa — alohida ish (har o'zgarishni yozish).

**38. «To'lov qabul qilish» qanday ishlaydi?** — ochiq
*Taxmin:* Kassa sahifasiga o'tadi va «Kirim» oynasida o'quvchi oldindan tanlanadi; kassa bitta
bo'lsa oyna o'zi ochiladi, bir nechta bo'lsa kassir kassani tanlaydi (pul boshqa kassaga tushib
ketmasin). Summa, tur va oyni kassir o'zi kiritadi. Tugma faqat Kassaga ruxsati bor xodimga
ko'rinadi. Panelning ichida to'lov oynasi — keyinroq, kassa tanlovi aniqlangach.

**39. Guruh holati yorliqlari** — ochiq
Eski interfeysda «Yig'ilayotgan» / «Aktiv»; dizaynda «Yig'ilmoqda» / «Faol».
*Taxmin:* yangi versiyada dizayndagisi (DESIGN → «Holat belgilari»), eski versiya o'zgarmaydi.

**40. «Ma'lumotlar» bo'limida yana nima?** — ochiq
Rasmda: Telefon, Filial, Manba, Guruhga qo'shilgan.
*Taxmin:* shu to'rttasi. Ota-ona, manzil, tug'ilgan kun — to'liq profilda.

**41. To'lovlar ro'yxati** — ochiq
Rasmda faqat bo'sh holat bor.
*Taxmin:* oxirgi 5 ta to'lov (sana · to'lov turi · qaysi oy uchun, summa), tasdiq kutayotgani —
«Kutilmoqda»; ko'p bo'lsa «Hammasi (N)» — profilning tranzaksiyalar tabiga.

## Reja

**7. Yangi versiya qanday quriladi** — ochiq (foydalanuvchi tushuntiradi)
Dizayn manbasi (Figma / HTML / rasm), qaysi sahifalardan boshlanadi, yangi versiyani
avval kim ko'radi (adminlar yoki hamma).

**27. Versiya almashtirgichi — qanday ishlaydi** — qisman hal qilindi (17.10, «verceldagi test
bazaga yangi versiya/eski versiya o'zgartiradigan joy qo'shib tur»; o'sha kuni «tizimli24.uz ga
ham qo'sh bugungi yangi dizayn bo'yicha ishlarni» — prod'da ochildi, pastda)
Qilingani: tanlov brauzer cookie'sida (`tizimli_ui`), manzillar o'zgarmaydi; almashtirgich
eski versiyada yuqori panelda, yangisida yon menyuning pastida va profil menyusida
(«Eski versiyaga qaytish»). FAQAT sinov saytida (Vercel) va lokal dev'da ko'rinadi — prod
serverda hamma eski versiyada, kod u yerga tushsa ham. Yangi versiyada hozircha qobiq
(yon menyu + yuqori panel) yangi, sahifalarning ichi eski — bo'limma-bo'lim almashadi.
PROD (17.10.2026): server `.env.local` da `UI_V2_SWITCH=on` — almashtirgich tizimli24.uz da
ham, HAMMA xodimga ko'rinadi; sukut eski versiya, har kim o'zi o'tadi va qaytadi.
*Ochiq:* faqat adminlarga cheklash kerakmi (7-savoldagi «avval kim ko'radi»).
*Taxmin:* hammaga — sinov saytidagidek; cheklash kerak bo'lsa rol bo'yicha qo'shiladi.

**28. «Ishlab chiqilmoqda» belgisi — matn va yopilishi** — ochiq (17.10, «yangi versiyaga
o'tganda qayerdadir "yangi versiya hozir texnik ish davom etmoqda" yoki shunga o'xshash
professional so'z turishi kerak, xodimlarga bilintirish uchun»)
Qilingani: logotip yonida DOIM «Beta» (sichqoncha ostida «Yangi versiya ishlab chiqilmoqda»);
yuqori panel ostida qator — «Yangi versiya ishlab chiqilmoqda. Bo'limlar bosqichma-bosqich
yangilanmoqda, ma'lumotlar ikkala versiyada bir xil.» + «Eski versiyaga qaytish» + ×.
*Taxmin:* × qatorni KUN OXIRIGACHA yopadi, ertasi kuni yana chiqadi (har kuni bir marta
eslatadi, ish paytida xalaqit bermaydi); «Beta» yopilmaydi. Butunlay yopilmaydigan qator
kerak bo'lsa — × olib tashlanadi.
