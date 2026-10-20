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

**8. Lid holati nomi: «Birinchi darsga» yoki «Sinov darsiga yozildi»** — qisman hal qilindi (20.10, Lidlar rasmlari)
Komponentlar rasmida «Birinchi darsga», hozirgi saytda va Telegram xabarlarida
«Sinov darsiga yozildi».
*Taxmin (17.10):* hozirgi nom qoladi (rasmdagisi namuna yozuv).
*20.10:* 5-qism rasmlarida (Lidlar, Lid paneli, Guruhga qo'shish) izchil «Birinchi dars» /
«Birinchi darsga yozildi» — YANGI VERSIYADA shu nom. Eski sayt va Telegram xabarida «Sinov darsiga
yozildi» qoladi (holat bitta, faqat yozuvi ikki xil). *Ochiq:* Telegram xabari ham «Birinchi dars» ga
o'tsinmi?

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

*Guruhlar ro'yxati va «Ustunlar» oynasi qurildi (18.10.2026, rasm «Guruhlar · Ustunlar»,
`components/v2/groups/GroupsListV2.tsx`, `components/v2/ui/ColumnsControl.tsx`):*

**42. Guruhlarda «Yana filtrlar» ichida nima?** — ochiq
Rasmda oyna ochilmagan.
*Taxmin:* eski sahifadagi qolgan filtrlar — Kun, Toq/Juft kunlar, Dars vaqti (dan – gacha, 30
daqiqalik qadam), Xona — va yangi «Ta'lim turi» (Oflayn / Onlayn). Kurs, O'qituvchi, Guruh
holati — tepada.

**43. Xulosa qatoridagi sonlar nimani sanaydi?** — ochiq
*Taxmin:* RO'YXATDAGI (filtrdan o'tgan) guruhlar bo'yicha: «N ta guruh», «O'quvchilar» —
ulardagi takrorlanmas o'quvchilar, «Muzlatilgan» — ulardagi muzlatilgan O'QUVCHILAR (eski
sahifadagi «Muzlatilgan o'quvchilar soni», guruhlar emas). Eski sahifada birinchi ikkalasi filtrga
qaramay hamma guruhlar bo'yicha edi — u o'zgarmadi.

**44. Bugun davomat qilinmagan guruh (eski sariq qator)** — ochiq
Rasmda bunday qator yo'q.
*Taxmin:* «Ogohlantirish» foni + chapda 3 px chiziq (sichqoncha ostida «Bugun davomat
qilinmagan»), xulosada «• Bugun davomat qilinmagan N» — faqat bunday guruh bo'lsa.

**45. Import qayerda?** — ochiq
Rasmda tepada faqat «Export» va «+ Guruh qo'shish» («⋯» yo'q); eski sahifada «Import (CSV)» bor.
*Taxmin:* «Export» menyusida, ajratgichdan keyin «CSV fayldan import» — fayl shakli eksport bilan
bir xil.

**46. Qator zichligi: Ixcham va Keng** — ochiq
Rasmda «Ixcham» tanlangan va qatorlar ~52 px.
*Taxmin:* Ixcham — rasmdagi (sukut), Keng — 64 px. «Ustunlar» oynasi (tartiblash, «doim»,
zichlik, «Standartga qaytarish») — hamma ro'yxatda bir xil: O'quvchilar ro'yxati ham shu oynaga
o'tkazildi («O'quvchi — doim»), saqlangan tanlovlar o'z holicha qoldi.

**47. Menyuda «Guruh» ichidagi bandlar** — ochiq
Rasmda: Guruhlar (son bilan), Barcha vazifalar, Xonalar, Jihozlar, Guruh o'quvchilari — «Dars
jadvali» yo'q.
*Taxmin:* «Dars jadvali» qoladi (haqiqiy sahifa, `/groups-schedule`); ichki band «Guruh» →
«Guruhlar» deb nomlandi (faqat yangi versiyada).

**48. Qidiruv nima bo'yicha?** — ochiq
Rasmda «Guruh nomi bo'yicha».
*Taxmin:* eski sahifadagidek guruh nomi, kurs, o'qituvchi va xona bo'yicha (sichqoncha ostidagi
izohda shunday yozilgan); yozuv rasmdagidek qoldi.

**49. Saralash** — ochiq
Rasmda saralash ko'rsatkichi yo'q; eski sahifada saralash umuman yo'q edi.
*Taxmin:* «Guruh nomi», «O'quvchilar», «Boshlanish / Tugash sanasi» sarlavhasi bosilsa
saralanadi; uchinchi bosish — sukut tartib (guruh yaratilgan tartibi).

**50. «Yana filtrlar» tugmasining ko'rinishi** — ochiq
Guruhlar rasmida yopiq tugma UZUQ chegarali, ikonkasi kamayuvchi chiziqlar; O'quvchilar rasmida u
ochiq holatda edi (brend chegara + halqa).
*Taxmin:* hamma ro'yxatda shunday: yopiq — uzuq, ochiq — brend + halqa, filtr qo'llangan — brend
fon + son. O'quvchilar sahifasi ham moslandi.

*Kassalar qurildi (18.10.2026, rasm «Kassalar», `components/v2/finance/CashboxesV2.tsx`):*

**51. Bosh kassa qayerda?** — ochiq
Rasmda: «4 ta filial kassasi · bosh kassa — Rahbar panelida», ro'yxatda bosh kassa yo'q.
*Taxmin:* «Rahbar paneli» hali yo'q — shu bois bosh kassa hozircha shu ro'yxatda, eng tepada (toj
ikonka, «Bosh kassa · mas'ul», kutilayotgan ko'chirma, «Kunlik topshiruv»). Rahbar paneli qurilganda
u yoqqa ko'chadi; sarlavhadagi «— Rahbar panelida» ham shunda qo'shiladi.

**52. «Ko'chirmalar faqat Rahbar kassasiga»** — ochiq, QAROR KERAK
Rasm pastida shunday yozilgan, hozirgi tizimda esa ko'chirma ISTALGAN kassaga yuboriladi.
*Taxmin:* qoida o'zgartirilmadi (bu biznes qarori); pastda haqiqatga mos izoh: «Ko'chirma qabul
qiluvchi ✓ bosgunicha jo'natuvchi kassada turadi». Faqat rahbar kassasiga cheklash kerak bo'lsa —
ayting, ko'chirish oynasi va server bilan birga qilinadi.

**53. Tranzaksiyalar — qaysi kassalar?** — ochiq
*Taxmin:* «Barcha kassalar» = xodimga ko'rinadigan hamma kassa (admin — hammasi, kassir — o'ziniki;
server har birini tekshiradi). Kartochka yoki «Kassa» chipi bitta kassaga toraytiradi. Sukut sana —
bugun.

**54. Ism yonidagi vaqt («Dilmurod Komilov · 11:41»)** — ochiq
*Taxmin:* rahbar oxirgi topshiruvni QABUL QILGAN vaqt (bugun — soat, aks holda kun); topshiruv
bo'lmagan kassada vaqt yo'q (rasmdagi birinchi kartochkadagidek). To'liq sana — sichqoncha ostida.

**55. «Ko'z» — summani yashirish** — ochiq
Rasmda bitta kassa ochiq, uchtasi «••••••». Eski sahifada bitta umumiy tugma edi.
*Taxmin:* har kassada alohida, shu brauzerda eslab qolinadi; sukut — ko'rinadi. Jadvaldagi summalar
yashirilmaydi.

**56. Kartochkada nima yo'q bo'ldi?** — ochiq
Eski kartochkada: «Oxirgi topshiruvdan beri chiqim», to'lov turlari bo'yicha qoldiq qatorlari (bosilsa
turlar orasida ko'chirish), Dividend / Sarmoya plitkalari.
*Taxmin:* chiqim — tushum qatorining izohida; to'lov turlari — qoldiq izohida va «⋯» menyusida
(bosilsa — o'sha ko'chirish oynasi); Dividend / Sarmoya — «⋯» da. Turlarni surib tartiblash eski
sahifada qoladi (tartib ikkala versiyada bir xil o'qiladi).

**57. «Umumiy hisobot» nima?** — ochiq
*Taxmin:* kassalar qoldig'i (har kassa: qoldiq, to'lov turlari, oxirgi topshiruvdan beri tushum /
chiqim, kutilayotgan ko'chirma) — Excel/CSV, va «Moliya hisobotlari» sahifasiga havola. «Hisobot ⌄»
(jadval ustida) — tranzaksiyalar, «Kassa» ustuni bilan. Ikkalasi faqat admin (eski qoida).

**58. Kirim / Chiqim soni va yig'indisi** — ochiq
*Taxmin:* eski sahifa qoidasi: faqat qabul qilingan yozuvlar (tasdiq kutayotgan va bekor qilingan
kirmaydi), ko'chirmalar ishorasi bo'yicha (chiquvchi — chiqim, keluvchi — kirim; «Barcha kassalar» da
bir-birini yopadi, «Farq» ga ta'sir qilmaydi).

**59. Jadvalda «Oyligiga», «Izoh», «Holati» ustunlari** — ochiq
Rasmdagi jadvalda yo'q.
*Taxmin:* izoh — «Kim / nima» ostida («Chiqim · xarajat»), holat — belgi bilan (tasdiq kutmoqda,
bekor qilingan, tahrirlangan; ✓ / × shu yerda), ustoz va qabul qilgan kassir — sichqoncha ostida va
tranzaksiya oynasida.

**60. Oy nomi imlosi** — ochiq
Rasmda «12-oktabr», ilovada hamma joyda «Oktyabr» (lib/i18n.ts).
*Taxmin:* bir xillik uchun ilovadagisi («18-oktyabr»); imlo almashsa — bitta joyda.

*Oylik chiqarish qurildi (19.10.2026, rasmlar «Oylik chiqarish» va «Oylikni chiqarish oynasi»,
`components/v2/finance/PayrollV2.tsx`):*

**61. Soliq qaysi summadan olinadi?** — ochiq, QAROR KERAK
Rasmda: «Soliq · 12% — kartadagi qismdan ushlanadi», qatorda «580 645 × 12%» (rasmiy oylik × kun/oy).
Tizimda soliq xodimga biriktirilgan qoidalar bo'yicha (bir nechta bo'lishi mumkin: foiz yoki qat'iy
summa) HISOBLANGAN oylikdan olinadi (lib/salary.ts → payrollTaxLines).
*Taxmin:* hisob o'zgartirilmadi. Sarlavhada stavka faqat soliqli hamma xodimda bitta foizli qoida
bo'lsa («Soliq · 12%»), qatorda «hisoblangan × 12%». Kartadagi qismdan olish kerak bo'lsa — ayting
(pul hisobi: server, eski sahifa, chek va bot birga o'zgaradi).

**62. Karta oy kunlariga bo'linadimi?** — ochiq
Rasmda kartaga «rasmiy 1 500 000» ning 12/31 qismi. Tizimda 16.09.2026 dan karta davrga BO'LINMAYDI —
qoldiqdan birinchi, plastik summasigacha (oy o'rtasida karta ulushi naqdga chiqib ketmasin).
*Taxmin:* tizimdagidek; rasmdagi raqamlar namuna. Qatorda «rasmiy N», yetmagani — sichqoncha ostida.

**63. «Ushlangan soliq Moliyaviy rejadagi «Soliqlar»ga qo'shiladi»** — ochiq
Hozir soliq hech qayerga qo'shilmaydi — chiqarish hujjatida (`salary_runs.soliq`, Chiqarishlar
tarixi) qayd etiladi.
*Taxmin:* oynadagi matn haqiqatga moslandi («… chiqarishlar tarixida qayd etiladi»). Moliyaviy rejaga
avtomatik qo'shish kerak bo'lsa — alohida ish.

**64. «To'lanmagan qolgan oylik keyingi oyga izoh bilan o'tadi»** — ochiq
04.10.2026 qoidasi: o'tgan oyning to'lanmagan qoldig'i keyingi oyda TO'LANMAYDI — faqat izoh
(«Sentyabr: 314 000 →»), o'z oyi sahifasidan chiqariladi.
*Taxmin:* jadval ostidagi izoh shunga moslandi.

**65. «Qolgan oylik» ustuni nima?** — ochiq
Rasmda «Qolgan oylik» = kartaga + naqd (jami to'lanadigan). Eski sahifadagi «Qolgan» — faqat kartadan
keyingi naqd edi.
*Taxmin:* yangi versiyada rasmdagidek — jami (manfiy bo'lsa «qarzdor»); naqd qismi sichqoncha ostida va
chiqarish oynasida har xodim qatorida («kartaga · naqd · soliq»).

**66. «Faqat kartani chiqarish» qayerda?** — ochiq
Rasmda yo'q (30.09.2026 qo'shilgan amal).
*Taxmin:* «Oylikni chiqarish» yonidagi ⌄ menyusida; tanlanmagan bo'lsa — kartasi bor hammaning karta
qismi (eskisidek), oyna o'sha dizaynda («Kartaga chiqarish»).

**67. To'lov turini tanlash** — ochiq
Rasmda «Plastik · kartaga» va «Naqd» qat'iy. Eski oynada ikkala qismning to'lov turi tanlanardi.
*Taxmin:* qator bosilsa turlar menyusi (har tur yonida kassadagi summa); sukut eskisidek. Kassada
shu tur yetmasa — qizil qator va «Mablag' yetarli emas — N kam».

**68. Rasmda yo'q ko'rsatkichlar** — ochiq
Eski kartochkalarda «To'langan oylik» va avansning boshqa filial bilan farqi bor edi.
*Taxmin:* «Jami avans» ostida «oylik to'langan N»; filiallar farqi — sichqoncha ostida. Jadvalda
«To'langan» va «O'tgan oydan» — qiymati bo'lsa o'zi chiqadi (rasmdagi izoh); «Kartaga» — kartali
xodim bo'lsa. Yashirilgan ustunlar: Telefon, Xodim turi.

**69. Izoh (ixtiyoriy)** — ochiq
Rasmdagi maydon uchun serverga qo'shimcha: izoh har chiqim yozuviga («Oylik chiqarish #7 — …») va
chiqarish hujjatiga yoziladi (tarix oynasida ko'rinadi), 200 belgigacha.

**70. Yon menyuda «Rahbar paneli → Oylik chiqarish»** — ochiq
Rasmda Oylik chiqarish «Rahbar paneli» guruhida (Umumiy ko'rinish, Rahbar kassasi, Ko'chirmalar,
Tasdiqlar, Oylik chiqarish, Moliyaviy reja…).
*Taxmin:* menyu o'zgartirilmadi; Rahbar paneli qurilganda (51-savol) birga ko'chadi.

### 4-qism: formalar (To'lov qabul qilish, Kassa amali, Yangi o'quvchi, «+ Yangi»), 19.10.2026

**71. To'lov qabul qilish — «Qaysi oy uchun» chiplari** — ochiq
Rasmdagidek: joriy oy («· joriy») va keyingi ikki oy; o'tgan oy — «Boshqa oy» panelida (yil + 12 oy).
Sana o'zgarsa oy ham ergashadi, oy qo'lda tanlangan bo'lsa — yo'q (eski oyna qoidasi).
*Taxmin:* qarz to'lovi ko'p bo'lsa chiplarga o'tgan oy ham qo'shiladi.

**72. To'lov qabul qilish — tur, o'qituvchi, qayerdan ochiladi** — taxmin
Oynada «Toifa» yo'q (rasmdagidek): tur — «Mijoz» da O'quvchi + O'qituvchi belgilangan birinchi kirim
turi («Kurs to'lovi (oylik)»); o'qituvchi — tanlangan guruhdan (guruh almashsa o'zi almashadi).
Guruhi yo'q o'quvchida — «O'qituvchi (ixtiyoriy)» tanlovi (eski oynada o'qituvchi qo'lda tanlanardi).
Boshqa turdagi kirim — «Kassa amali → Kirim». Mantiq, tekshiruv va so'rov — eski Kirim oynasi bilan
BITTA (components/finance/useKirimForm.ts): izohdagi oy qorovuli, tanga chegirmasi o'sha-o'sha.
O'quvchilar → tezkor panel → «To'lov qabul qilish» endi shu oynani ochadi (Kassalarga o'tmaydi).

**73. To'lov qabul qilish — kassa va to'lov turi sukuti** — taxmin
Kassa — Bosh kassa (xodim faqat o'z kassasini ko'radi — o'shanisi). To'lov turi sukutsiz: kassir
ataylab tanlaydi (rasmda «Naqd» tanlangan — u kassir bosgandan keyingi holat deb olindi).

**74. «Sana va vaqt» — vaqt tanlanmaydi** — ochiq
Server yozuvga SAQLASH paytidagi vaqtni qo'yadi (lib/cashboxAdjust.ts → nowTime), shuning uchun
maydonda joriy soat ko'rsatiladi va o'zi yangilanadi. Vaqtni qo'lda kiritish kerakmi? (API'ga
ixtiyoriy `time` qo'shiladi.)

**75. Toast «Chekni ko'rish»** — qilindi
Saqlangach pastki o'ngda «To'lov qabul qilindi» + ism + «summa · tur · kassa» + «Chekni ko'rish»;
chek oynasi qobiqda ochiladi (forma allaqachon yopilgan). Kassa amali → Kirim ham; Chiqim va
Ko'chirmada chek tugmasi yo'q.

**76. Kassa amali — «Chek rasmi (ixtiyoriy)»** — ochiq
Rasmdagi yuklash maydoni QILINMADI: tranzaksiya yozuvida fayl saqlanadigan joy yo'q (jurnal,
Sheets, Telegram ham bilmaydi). Qilish uchun: Cloudinary papka, yozuvga fayl manzili, tranzaksiya
oynasida ko'rsatish. Kerakmi?

**77. Kassa amali — «To'lov turi» izohi** — taxmin
Rasmda «Shu kassa qabul qiladigan turlar»; bazada kassaga bog'langan turlar ro'yxati yo'q.
*Taxmin:* Chiqim va Ko'chirishda — shu kassada mablag'i bor turlar (eski oynalar qoidasi), izohi
«Kassada mablag'i bor turlar»; Kirimda — barcha faol turlar. Kassa ostida tanlangan turning qoldig'i
(«Plastik qoldig'i: … so'm»), kartochkada yashirilgan kassada «•••••• · summalar yashirilgan».

**78. Kassa amali — Ko'chirish manzili** — ochiq (52-savol bilan)
Eski oynadagidek — tizimdagi hamma kassa (faqat nomi). Faqat Rahbar kassasiga cheklash — 52-savol.

**79. Kassa amali — tablar** — taxmin
Tab almashganda kiritilgan narsa YO'QOLMAYDI (tab yashirinadi); «Saqlanmagan o'zgarishlar bor»
istalgan tabdagi o'zgarishga qaraydi; saqlash — faol tabniki. Kassani oyna ichida almashtirsa
bo'ladi (rasmdagi «Kassa» maydoni). Mantiq — eski oynalarniki (useKirimForm, useChiqimForm,
useTransferToForm): oylik chegarasi, kelajak/yopilgan oy, o'quvchiga qaytarish, «tasdiq kutmoqda».

**80. Kassa amali — Chiqim summasi bitta** — taxmin
Eski Chiqim oynasida bir nechta «Qiymat» qatori (+) bor edi; rasmda bitta «Summa». Bitta qoldi.
Kirimdagi «uchinchi shaxs» qatorlari (Qiymat + Oy) saqlandi.

**81. Yangi o'quvchi — majburiy maydonlar** — taxmin
Rasmda «(ixtiyoriy)» faqat Tug'ilgan sana va Guruhda. *Taxmin:* Ism, Familiya, Telefon (9 raqam),
Kategoriya, Manba — majburiy (eski oynada faqat Ism va Manba). Telefonsiz o'quvchi kerak bo'lsa —
Telefon ixtiyoriy qilinadi.

**82. Yangi o'quvchi — Filial** — ochiq
Server o'quvchini NAVBARDAGI filialga yozadi; maydon faqat ko'rsatadi («Navbardagi filial»).
Boshqa filialni shu yerda tanlash — server o'zgarishi (filial ruxsati tekshiruvi bilan). Kerakmi?

**83. Yangi o'quvchi — guruh kategoriyasi** — taxmin
Bazada guruh ↔ kategoriya bog'lanishi yo'q. *Taxmin:* guruh kategoriyasi = a'zolarining ko'pchiligi
kategoriyasi (O'quvchilar sahifasidan ochilganda); «Kategoriya bo'yicha saralangan · Hammasini
ko'rsatish». «+ Yangi» dan ochilganda saralanmaydi. Aniq bog'lanish kerak bo'lsa — kursga
«Kategoriya» maydoni.

**84. Yangi o'quvchi — «Saqlab, yana qo'shish», «Boshqa» manba, takroriy telefon** — taxmin
Keyingisi uchun kategoriya, manba va guruh qoladi, shaxsiy maydonlar tozalanadi. «Boshqa» manba —
eski ichki oyna o'rniga Manba ostida matn maydoni. Takroriy telefon — sariq ogohlantirish
(«Bu raqam O'quvchilarda bor: … Ochish» — yangi varaqda), saqlashni to'xtatmaydi.

**85. «+ Yangi» menyusi** — taxmin
O'quvchi (o'ngdan), To'lov qabul qilish va Kassa amali (markazda) — SHU JOYDA; Lid — Lidlar
sahifasida (`?add=1`, eski oyna); Topshiriq — Topshiriqlar sahifasida (`?new=1`, faqat rahbar
rejimida ko'rinadi). Rahbar (admin) bandlari: Guruh (`/groups?add=1` — oyna o'zi ochiladi), Xodim
va Bonus/jarima — sahifasiga o'tadi (formasi hali yangi versiyada yo'q). Telefonda «+ Yangi»
avvalgidek yo'q.

**86. Toast va tasdiq oynasi** — qilindi (qisman)
Yangi versiyada toast pastki o'ngda (telefonda pastki menyu ustida), 5 s, sichqoncha ustida kutadi,
xato o'zi yopilmaydi («Qayta urinish» — qayerda ma'noli bo'lsa). Xavfli amal tasdig'i (qizil tugma,
«Kassani arxivlaysizmi?» qolipi) tayyor; hozircha «Saqlanmagan o'zgarishlar bor» da ishlaydi,
qolgan joylar sahifalari yangilanganda ulanadi.

### 5-qism — Lidlar, Lid paneli, Guruhga qo'shish (20.10.2026)

**87. Lidlar — sukut davr «Shu oy»** — taxmin
Rasmda davr tanlovi «Shu oy», sarlavhada «shu oy 29 ta lid». *Taxmin:* sahifa ochilganda — shu oy
(lid KELGAN sana bo'yicha), «Butun davr» bitta bosishda. *Xavf:* o'tgan oydan qolgan, hali ishlanmagan
«Yangi» lid sukutda ko'rinmaydi. Kerak bo'lsa: sukut «Butun davr» yoki ishlanmaganlar davrdan qat'i
nazar doim ko'rsatiladi. «Bugun birinchi dars · N» filtri davrga qaramaydi.

**88. «Rad etdi» rangi** — taxmin
Komponentlar rasmida (4-fayl) rad — qizil, Lidlar sahifasi rasmida — BETARAF (kulrang belgi va
nuqta). *Taxmin:* sahifa rasmi — ro'yxat va panelda kulrang; «Rad etdi» TUGMASI qizil (xavfli amal).

**89. Ko'rsatkich kartalari ostidagi izohlar** — taxmin
Rasmda: «shu oy», «5 tasi 24 soatdan oshdi», «shu hafta», «shu oy». *Taxmin:* Barchasi va Guruhga
qo'shildi — tanlangan davr; Yangi — 24 soatdan ko'p kutayotganlar (eski sahifadagi qoida); Birinchi
darsga yozildi — darsi SHU HAFTADA bo'lganlar (hammasi bo'lsa «shu hafta», bir qismi — «N tasi shu
hafta»; hafta sana tanlovidagidek yakshanbadan). Guruhga qo'shildi ostida konversiya foizi kerakmi?

**90. «Keyingi qadam» ustuni va sukut saralash** — taxmin
Rasmda bunday maydon bazada yo'q — holatdan HISOBLANADI: Yangi — «→ Qo'ng'iroq qilish · 2 soatdan
beri» (24 soatdan oshsa sariq soat; takroriy raqamda «takroriy raqam»), Bog'lanildi — «→ Birinchi darsga
yozish», Birinchi dars — bugun: «Bugun birinchi dars 14:00 · 205-xona», oldinda: «Chorshanba, 16:00
birinchi dars», o'tgan: «→ Guruhga qo'shish · dars o'tdi» (kelmagan — «Boshqa kunga yozish · kelmadi»),
sanasiz — «Sanani belgilash»; Guruhga qo'shildi — «O'quvchilarga o'tdi», Rad — «Sabab: …». Rasmda
sarlavha qalin — sukut saralash shu ustun bo'yicha, shoshilinchi tepada: bugungi dars → kechikkan yangi
→ yangi (uzoq kutgani oldin) → bog'lanildi → o'tgan/sanasiz dars → oldindagi dars → guruh → rad.

**91. Birinchi dars qaysi guruhda (xona, «Birinchi dars shu guruhda»)** — taxmin
Bazada sinov darsining GURUHI yozilmaydi (faqat sana, vaqt, o'qituvchi). *Taxmin:* guruh topiladi —
o'sha o'qituvchi, o'sha soatda boshlanadigan, o'sha hafta kuni darsi bor guruh (bir nechta bo'lsa —
lid kursidagisi; aniq bitta chiqmasa xona ko'rsatilmaydi). «Birinchi darsga yozish» oynasida guruh
tanlansa o'qituvchi/vaqt/sana o'shandan — topish aniq ishlaydi. Aniq bog'lash kerak bo'lsa — lidga
guruh id'si (server o'zgarishi).

**92. «Birinchi darsga yozish» va «Rad etish» oynalari** — taxmin
Rasm berilmagan — «Guruhga qo'shish» qolipida yasaldi. Birinchi dars: ixtiyoriy «Guruh darsiga»
(tanlansa o'qituvchi, vaqt va guruhning keyingi darsi o'zi qo'yiladi), Sana, Vaqt («16:00»), O'qituvchi
(kurs o'qituvchilari tepada; tanlanmasa — birinchisi, eski oynadagidek). Rad: sabab chiplari (Sozlamalar
→ Lidlar ro'yxati) + «Boshqa sabab», qizil «Rad etish» bilan tasdiq (eski oynada sabab bosilishi bilan
saqlanardi). So'rov ikkalasida eski oyna bilan bir xil.

**93. Guruhga qo'shish — guruhlar va boshlash sanasi** — taxmin
Guruhlar — lid kursidagilar (yo'q bo'lsa — hammasi; «Boshqa kurslar guruhlari (N)»), lid filiali
(1+2 hovuz), ARXIV guruhlar yo'q (eski oyna «tugagan» holatini tekshirardi — bunday holat endi yo'q).
Sukut tanlov — sinov darsi bo'lgan guruh. Boshlash sanasi — guruhning KEYINGI darsi (bugungi dars hali
boshlanmagan bo'lsa — bugun); jadvali o'qilmasa — sinov darsi (o'tmagan bo'lsa) yoki bugun. «Boshqa
sana» — taqvim. «Saqlagach, to'lov oynasini ochish» — faqat Kassaga ruxsati borga; o'quvchi va guruh
tanlangan holda ochiladi.

**94. «Xato bo'lsa, 10 daqiqa ichida bekor qilish mumkin»** — ochiq
Bekor qilish LID HOLATINI qaytaradi, o'quvchi GURUHDA QOLADI (23.09.2026 qarori — guruhdan chiqarish
to'lov va davomatga tegadi). Oyna matni «lid holatini … bekor qilish mumkin» deb aniqlashtirildi, panelda
«Bekor qilish» ostida ogohlantirish bor. O'quvchini ham guruhdan chiqarsinmi?

**95. Bekor qilish qayerda** — taxmin
Rasmda yo'q. *Taxmin:* panelda bosqich kartasi ostida «Oxirgi o'zgarishni bekor qilish · 9 daq qoldi»
(10 daqiqa — har kim, keyin — faqat direktor; muddati o'tgan oddiy xodimga ko'rsatilmaydi) va holat
o'zgargandan keyingi toastda «Bekor qilish» (guruhga qo'shishda — «Profilni ochish», o'quvchi guruhda
qolgani uchun).

**96. Sarlavhadagi «⋯», «So'rovnoma havolasi», belgilash** — taxmin
Rasmda faqat «So'rovnoma havolasi» va «+ Lid qo'shish». Eski sahifadagi eksport (Excel/CSV) va «Lidlar
sozlamalari» yo'qolmasin deb «⋯» qo'shildi (+ «Birinchi darsga yozilganlar»). «So'rovnoma havolasi» —
menyu: nusxalash / sahifani ochish. Jadvaldagi katakchalar — belgilanganlarni eksport qilish (ommaviy
SMS, rad yoki mas'ul tayinlash kerak bo'lsa — keyin).

**97. Takroriy raqam belgisi** — taxmin
DESIGN.md jadval qoidasida «ism yonida Takroriy belgisi», Lidlar rasmida — telefon yonida sariq
ikonka. Sahifa rasmiga ergashildi; sichqoncha ostida «Takroriy raqam — avvalgi lid #N».

**98. Lid qo'shish/tahrirlash, SMS, chek, izohlar** — taxmin
Rasmda yo'q — hozircha ESKI oynalar (Yangi lid formasi rasmi kelganda almashadi — DESIGN.md: uzun forma
o'ngdan). Panel «⋯»: Tahrirlash, Izohlar, Chek, Telegramda yozish (botdan kelgan lid), Raqamni
nusxalash, To'liq karta (eski /orders-list/[id] — boshqa filialga o'tkazish va h.k.).

### 6-qism — Moliya analitikasi, «Hisobotni yuklab olish» (20.10.2026)

**99. Eski tablar — Kalendar, Journal, Pul oqimi** — taxmin
Rasmda yo'q — yangi versiyada yo'q, eski versiyada qoladi. Har amal — Kassalar sahifasining
«Tranzaksiyalar» jadvalida va hisobotda («Kassalar bo'yicha tranzaksiyalar»). Kunlik kalendar kerakmi?

**100. Bekor qilingan amal tushum va chiqimda** — ochiq, QAROR KERAK
`transactions` da bekor qilish teskari yozuv («… (bekor qilindi)») bilan. Eski «Pul oqimi» va P&L uni
chiqimga qo'shadi — tushum ham, chiqim ham oshib ko'rinadi (sof foyda to'g'ri). Yangi analitikada
bekor qilingan to'lov TUSHUMDAN ayriladi (bekor qilingan chiqim — chiqimdan): ko'zguda 1–19-oktyabr
tushumi 164 452 001 — Tranzaksiyalar daftaridagi bekor qilinmagan to'lovlar bilan AYNAN bir xil.
Eski sahifalar ham shunday hisoblasinmi?

**101. Sof foydada ta'sischiga chiqim, dividend, sarmoya** — ochiq
Hozir hamma chiqim — oylik, avans, ijara va «Ta'sischiga chiqim (F-INVEST)» (sentyabrda 76,7 mln) —
chiqim, «Sarmoya» — tushum (eski P&L bilan bir xil). Biznes foydasi uchun ta'sischiga chiqim va
dividend chiqim emas (foydani olish) — chiqarib tashlansinmi?

**102. «Shu oy» yoki «Bu oy»** — taxmin
Analitika rasmida «Bu oy · 1–12-oktabr», Lidlar rasmida «Shu oy». Yangi versiyada hamma joyda «Shu
oy» (sana tanlovi bilan bir xil). Davr BUGUNGACHA — kelajak kunlar sanalmaydi.

**103. Solishtirish** — taxmin
«o'tgan oy» — o'sha kunlar bir oy oldin (1–20-oktyabr ↔ 1–20-sentyabr; butun oy ↔ butun oldingi oy),
«o'tgan yil», «oldingi davr» (shuncha kun, darhol oldin), «solishtirmaslik». Rasmda lid konversiyasi
«sentabrga nisbatan» — to'rttala ko'rsatkich bitta davr bilan solishtiriladi. Oldingi davrda 0 bo'lsa
foiz yo'q («solishtirish davrida ma'lumot yo'q»). Chiqim ko'paysa — qizil, kamaysa — yashil.

**104. Filial va kassa tanlovi** — taxmin
Filial — kassaning filiali (`cashboxes.branchId`): Rahbar kassasi 1-filialniki sifatida (ijara,
ta'sischiga chiqim shundan). Lidlar — lidning filiali (kassa tanlansa — o'sha kassaning filiali).
«Barchasi»: pul — hamma kassalar (eski sahifadagidek, sahifa ruxsati bo'lsa hammasi ko'rinadi), lidlar —
foydalanuvchiga ochiq filiallar (admin — hammasi). Navbardagi filial bu sahifaga ta'sir qilmaydi (eski
sahifadagidek).

**105. Ma'lumot tarixi** — fakt
Bazada kirim-chiqim yozuvlari 2026-sentyabrdan (yangi mavsum) — «oyma-oy» grafikda may–avgust bo'sh.
Eski (edutizim) tarixi ham ko'rinishi kerakmi?

**106. Lid → o'quvchi hisobi** — taxmin
Davrda KELGAN lidlar. «Yetib bordi» — hozirgi holat yoki tarixdagi eng yuqori bosqich: rad etilgan lid —
rad etilgunicha yetgan bosqichda, bekor qilingan o'zgarish sanalmaydi, tashlab o'tilgan bosqich — o'tilgan.
«O'quvchi bo'ldi» — guruhga qo'shilgan. Konversiya o'zgarishi — foiz punktida («4 p.p.»). Ko'zguda:
oktyabr 182 lid, 47%; sentyabr 204 lid, 8% — sentyabr lidlarining ko'pi eski sahifalardan guruhga
yozilgan bo'lishi mumkin (lid holati yangilanmagan).

**107. Manbalar** — taxmin
Lidning `source` maydoni (Tavsiya, Flyer, Sayt so'rovnomasi …) — rasmdagi nomlar namuna. 7 tadan ko'p
bo'lsa — 6 tasi + «Boshqalar»; manbasiz — «Manba ko'rsatilmagan» (oxirida).

**108. Grafik** — qilindi
Oxirgi 6 oy (davr tugagan oy bilan). Ranglar rasmdan o'lchandi (Kirim ko'k, Chiqim to'q sariq,
bosqichlar ko'k shkalasi) — dataviz validatori o'tdi. Davom etayotgan oy och; raqam faqat eng katta
kirim va oxirgi oyda; sichqoncha/fokus — maslahat oynasi; «Jadval» — to'liq so'mda.

**109. Hisobot** — taxmin
«Chorak» — joriy chorak (1-oktyabr–bugun; chorakning birinchi oyida «Shu oy» bilan bir xil); «Boshqa
davr» — taqvim. PDF — chop etish oynasi orqali («PDF sifatida saqlash»): loyihada PDF kutubxonasi yo'q.
Tranzaksiyalar — `transactions` dan (sana, vaqt, kassa, turi, to'lov turi, kirim/chiqim); o'quvchi ismi
yo'q — u `transaction_entries` da, unga Moliya analitikasi ruxsati ochilmagan.

**110. «Rahbar paneli» menyusi** — ochiq (13, 51, 70 bilan bitta)
Rasmda Moliya analitikasi «Rahbar paneli» guruhida (Umumiy ko'rinish, Rahbar kassasi, Ko'chirmalar,
Tasdiqlar, Oylik chiqarish, Moliyaviy reja, Bonus, Jarima, Moliya analitikasi). Menyu o'zgartirilmadi.

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
