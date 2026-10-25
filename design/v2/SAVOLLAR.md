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

**4. Onest shriftini yuklash** — HAL QILINDI (20.10.2026)
Google'dan (`next/font/google`) yoki loyiha ichiga joylab (`next/font/local`)?
Serverda Google shriftlari build'ni bir necha marta yiqitgan.
*Qaror (foydalanuvchi, 20.10: «ha, qil»):* HAMMA shriftlar loyiha ichida — npm `@fontsource`
paketlari (OFL): Onest (yangi qobiq), Nunito (eski versiya), Anton/Inter/Montserrat (/ariza),
Manrope/IBM Plex Sans (/sorovnoma). Build ham, sahifalar ham Google'ga murojaat qilmaydi; har
til qismi (lotin, kirill, kirill-qo'shimcha …) faqat kerak bo'lsa yuklanadi.

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

### 7-qism — Sozlamalar → Kurslar, Xodimlar, Xodim profili (20.10.2026)

**111. Kurs kategoriyasi** — taxmin, QAROR KERAK
Rasmdagi «Kategoriya» (Chet tillari / Fanlar / Arab tili) tizimda yo'q edi — kursga yangi `category` maydoni
qo'shildi. Ro'yxat: rasmdagi uchtasi + kurslarda ishlatilganlar; tahrirda «+ Yangi kategoriya». Alohida
«Kategoriyalar» sahifasining dizayni kelmagan (hozirgi O'quv → Kategoriya — o'quvchining NARX toifalari, boshqa
narsa). Bazadagi 16 kursning hammasi hozir kategoriyasiz. Taklif — bir martalik to'ldirish: Chet tillari — Ingliz,
Rus, Koreys, Turk, Nemis; Fanlar — Matematika, Ona tili, Biologiya, Kimyo, Fizika, Tarix, Huquq, Geografiya; Arab
tili — Arab tili; «Sertifikat» va «IT (Web dizayn)» — qaysi? Ruxsat bersangiz prod bazada skript bilan qilaman
(yoki qatorlarda o'zingiz belgilaysiz — ✎).

**112. Sozlamalar ichki menyusi** — taxmin
Bandlar mavjud sahifalarga olib boradi: Markaz ma'lumotlari → Umumiy sozlamalar, Filiallar, Xonalar, Kurslar,
Kategoriyalar (O'quv → Kategoriya), Kassalar (Kassa sahifasi — kassa qo'shish/arxivlash shu yerda), Kirim-chiqim
toifalari (Tranzaksiya turlari), To'lov turlari (Sozlamalar → Moliya), Manbalar, So'rovnoma sahifasi (Sozlamalar →
Sotuv → Lidlar), Jarima va muddatlar (Topshiriqlar → Sozlamalar, faqat direktor), Tanga qoidalari (Gamifikatsiya →
Sabablar). TIZIMDA YO'Q — menyuda o'chiq: Bildirishnomalar, Imtihon fanlari, Bonus sabablari, Referal dasturi,
Nazorat qoidalari. Ichki menyu hozircha faqat Kurslarda: eski /settings-* sahifalarida o'z tab menyusi bor (ikki
yonma-yon menyu bo'lardi) — ular dizayni kelganda shu ramkaga o'tadi. Yon menyudagi «Sozlamalar» o'zgarmadi.

**113. Kurs holati «Faol / Nofaol»** — taxmin
Rasmda hammasi «Faol». Yangi `active` maydoni: «⋯ → Nofaol qilish» — kurs YANGI lid, guruh va xodim
oynalaridagi «Kursni tanlang» ro'yxatidan chiqadi (xodimlar boti va MohirAI'ning yangi lidi ham); mavjud
guruh/lidlarda, filtrlar va hisobotlarda qoladi.

**114. Nom o'zgarsa** — qilindi
Server eski nom yozilgan guruh kursi, lid yo'nalishi, o'qituvchi fani va imtihon yozuvlarini yangi nomga ko'chiradi;
arxivdagi guruhlar va ishga arizalar tegilmaydi. Eski «Oflayn kurslar» sahifasida ham shunday (ilgari ko'chmasdi —
guruh tahririda «kurs topilmadi», qarzdorlar hisobotida narx yo'qolardi). Bir xil nomli ikki kurs endi yaratilmaydi.

**115. Kursni o'chirish** — taxmin
Guruhda ishlatilgan kurs o'chmaydi («N ta guruhda — nofaol qiling»), eski sahifada ham. Faqat lidlarda bo'lsa
o'chiriladi (lid nomini matn sifatida saqlaydi).

**116. Darajalar va narxlar** — taxmin
Rasmda yo'q — qator «⋯ → Darajalar va narxlar» (eski kurs sahifasi: darajalar, filial narxlari, kitob, mavzular) va
«Rang va filial narxlari». Rasmdagi izoh («Kategoriya va narx darajalari — «Kategoriyalar» bo'limida») bizda to'g'ri
emas — narx darajalari kursning o'zida; izoh shunga moslandi.

**117. Excel / CSV / import** — taxmin
Rasmda yo'q, eski sahifada bor — sarlavhadagi «⋯» da (fayl ustunlari eski bilan bir xil).

**118. Menyu nomlari** — taxmin
Yangi versiyada yon menyuda «Oflayn kurslar» → «Kurslar», «Rollar» → «Rollar va huquqlar». Kurslar O'quv bo'limida
ham qoldi. Rasmdagi Boshqaruv'da Filiallar va Ish jadvali yo'q — ular menyuda qoldirildi.

**119. Xodimlar — filtrlar** — taxmin
Rasmdagi uchtasi: Lavozim, Hisoblash usuli, Holati. Eski sahifadagi Kurs, Ketish sababi, Faollik va ketish sanasi
filtrlari yangi versiyada yo'q — kerakmi? «Holati» sukutda «Faol» (eski sahifadagi qaroringiz: arxivdagilar
aralashmasin), rasmda tanlanmagan ko'rinadi.

**120. «Shu filial oylik ro'yxatida yo'q»** — qilindi
Xodim shu filialda ishlaydi, oyligi esa boshqa filial ro'yxatida — ikki pul katagi o'rnida shu yozuv (ustida qaysi
filialda). Eski sahifada bunday xodim «Sozlanmagan» ko'rinardi. Haqiqatan sozlanmagani — «Ish haqi kiritilmagan —
sozlash».

**121. «Jami oylik» va «Qolgan oylik»** — taxmin
Oylik chiqarish bilan bitta manba. «Qolgan» — xodimga JAMI qarz (o'tgan oylarda to'lanmagani bilan; ostida «o'tgan
oylardan: …»), eski ro'yxat va profildagidek. Oylik chiqarishdagi «Qolgan oylik» — faqat shu oy to'lanadigani.

**122. Guruhlar ustuni** — taxmin
Guruh nomlari, o'qituvchi ismi bo'yicha (eski ro'yxatdagi bog'lanish; yordamchilik sanalmaydi — profilda «yordamchi»
belgisi bilan ko'rinadi).

**123. Birinchi qator rangi** — taxmin
Rasmda birinchi qator `brand-bg` — sichqoncha ustidami yoki tanlanganmi? Boshqa ro'yxatlardagidek kulrang hover.

**124. Soliq, plastik, tahrir** — taxmin
Eski jadvaldagi soliq va plastik tugmachalari — qator «⋯» da (eski oynalar); ustunlarini «Ustunlar»da yoqish mumkin.

**125. «Ishga qabul (CV)» soni** — ochiq
Rasmda yon menyuda «Ishga qabul (CV) 2» — yangi arizalar soni. Hozircha son yo'q (sanoq so'rovi kerak).

**126. Profilning eski tablari** — taxmin
Tranzaksiyalar, o'quvchilar to'lovlari, avans/oylik/balans tarixi, to'lanmagan to'lovlar, ish soati, KPI, eslatma —
rasmda yo'q. «Batafsil» kartasidan va «⋯ → Batafsil» dan eski ko'rinishda ochiladi (kerakli tab bilan).

**127. Guruhlar va jadval** — taxmin
Xodim o'qituvchi YOKI yordamchi bo'lgan guruhlar; «haftada N soat» — ustma-ust vaqt bir marta sanaladi (rasmdagi «12
soat» shunday chiqadi); bir vaqtga to'g'ri kelgan guruhlar sariq chegarali, ostida ogohlantirish. Kun nomlari ilova
tilidan («Cho», «Pay»; rasmda «Chor», «Pa»).

**128. Oylik kartasi** — taxmin
Rasmdagi qatorlardan tashqari, qiymati bo'lsa: Soliq va «Berilgan oylik»; «O'tgan oydan» — to'lanadigan + o'z oyidan
chiqariladigan (oylari yoziladi); kartasi bor xodimda «kartaga · naqd». Qatorlar yig'indisi «Qolgan oylik»ka teng.

**129. Topshiriqlar** — taxmin
Rasmdagi raqam — muhimlik (1–5); «Namuna» belgisi — dizaynerning izohi deb olindi, ko'rsatilmaydi. 5 tasi,
«Hammasi» — Topshiriqlar sahifasi. Holat nomi 23.10 dan «Faol» (134).

**130. «Topshiriq berish»** — qilindi
Topshiriqlar sahifasining shakli shu xodim tanlangan holda ochiladi; tugma faqat topshiriq bera oladiganlarga.

**131. «Avans berish»** — qilindi
Kassa amali oynasi «Chiqim»da, «Hodimga avans» va shu xodim tanlangan; tugma faqat Kassaga ruxsati borlarga.
Arxivdagi xodimda ikkala tugma yo'q.

**132. Huquqlar va login** — taxmin
«Huquqlar: rol bo'yicha» (xodimga alohida berilgan bo'lsa — «alohida — N bo'lim»); «login bor / taklif yuborilgan /
parol o'rnatilmagan / login yo'q» — tizim hisobidan (parol ko'rsatilmaydi).

**133. Profil amallari** — taxmin
«⋯»: Tahrirlash, Ish haqini sozlash, Soliq turlari, Plastik oylik, Parol (faqat admin), Qo'ng'iroq qilish, Batafsil,
Arxivlash — eski profildagi amallar, oynalari hozircha eski.

### 8-qism — Imtihon → Natija kiritish, Topshiriqlar, Yangi topshiriq (23.10.2026)

**134. «Faol» holat nomi** — taxmin
Ikkala rasmda ham (Xodim profili, Topshiriqlar) yangi topshiriq «Faol» — yangi versiyada «Yangi» → «Faol» (ro'yxat
va profil kartasi). Yuqoridagi «Faol» kartasi esa eski sahifadagidek hamma bajarilishi kerak bo'lganlar (yangi +
qaytarilgan + muddati o'tgan): rasmda 7 = 6 + 1, jami 10. Eski sahifa va bot nomlari o'zgarmadi.

**135. Sarlavha ostidagi yozuv** — taxmin
Rasmda «Akademiya 3 Uychi · siz bergan topshiriqlar». Ro'yxat yon menyudagi filial bilan kesilmaydi (23.09 dagi
qaror — «Filial» filtri bor) va rahbar o'z filialidagi boshqalar bergan topshiriqlarni ham ko'radi, shuning uchun:
direktor — «Barcha filiallar · barcha topshiriqlar», rahbar — «‹filial› · siz boshqaradigan topshiriqlar», xodim —
«Sizga berilgan topshiriqlar».

**136. «Holat» filtri** — taxmin
Rasmda yo'q (holatni kartalar filtrlaydi), lekin kartalarda Yakunlandi, Bekor qilindi, Qaytarildi yo'q — eski
sahifadagi holat filtri «Holat» chipi bo'lib qoldi (kartalar bilan bitta filtr).

**137. Tartib** — taxmin
Rasmdagidek rahbarga o'zi tasdiqlaydigan «Tasdiq kutilmoqda» eng tepada (binafsha qator), keyin muddati o'tgan,
faol, yopilganlar. Eski sahifada muddati o'tganlar birinchi; xodim ko'rinishida tartib o'zgarmadi.

**138. Yangi topshiriq oynasi** — taxmin
Eski formadagi tezkor muddat tugmalari («Bugun 18:00», «Ertaga 12:00», «3 kundan keyin») rasmda yo'q — olib
tashlandi (sukut baribir ertaga 18:00). «Kimga» ro'yxati filial bo'yicha guruhlangan, guruhda «Hammasini tanlash»
(eskidagidek). Ilova: maydon bosilsa fayl (sudrab tashlash ham), havola — «Havola» tugmasi; ostida «Rasm yoki PDF,
10 MB gacha» izohi qo'shildi. Sarlavha ostidagi filial — tanlangan xodimlarning filiali (topshiriq shunga yoziladi),
hali tanlanmagan bo'lsa joriy filial.

**139. Sarhisob ro'yxati** — taxmin
8-qismda faqat «Natija kiritish» bor; Imtihon sahifasining o'zi (oydagi sarhisoblar ro'yxati) rasmsiz — eski tabdagi
hamma narsa yangi qoidalar bilan qurildi (oy va fan filtri, to'rt ko'rsatkich, jadval, o'ngdan tafsilot, Eksport,
«+ Natija kiritish»). UzBMB — eski ko'rinishda. Rasmlari kelsa almashtiriladi.

**140. O'zlashtirish darajalari** — QAROR KERAK
Rasmda uch daraja: ≥ 80%, 60–79%, < 60% (< 60% — sariq chiziq va «past»). Eski sahifada to'rt rangli shkala (<50
qizil, 50–69 sariq, 70–84 och yashil, ≥85 yashil). Yangi versiyada rasmdagisi, eski sahifa o'zgarmadi — bir xil
qilinsinmi va qaysi biri?

**141. Tanlov tartibi** — taxmin
Eski panelda qat'iy Fan → Ustoz → Guruh edi. Endi erkin: guruh tanlansa fan («avto») va bo'sh bo'lsa ustoz guruhdan
to'ladi; fan tanlansa guruhlar shu fan bo'yicha; ustoz tanlansa uning guruhlari birinchi. Guruhdagi ustoz xodimlar
ro'yxatida topilmasa (import qilingan guruhlar) — ismi «guruhdagi ustoz» deb olinadi. Arxivdagi guruhlar
ko'rinmaydi.

**142. O'quvchi qatori bosilsa** — taxmin
Rasmdagi izoh bo'yicha o'ng karta o'quvchiga almashadi: guruhdagi o'rni (shu kiritishda, foiz bo'yicha) va oylar
bo'yicha natijalari (saqlangan sarhisoblardan, joriy filial, oxirgi 12 tasi). Bu ko'rinishning rasmi yo'q.

**143. Excel'dan yuklash va Eksport** — taxmin
Eksport — joriy jadval CSV (№, O'quvchi, To'g'ri javob, Savollar, %) — to'ldirib qaytarish uchun shablon ham.
Yuklash — .xlsx/.xls/.csv: ustunlar sarlavhadan («O'quvchi/Ism» va «To'g'ri javob/Ball»; sarlavha bo'lmasa — birinchi
harfli va undan keyingi raqamli ustun), ism bo'yicha («Ism Familiya» yoki «Familiya Ism»); topilmaganlar aytiladi,
savollar sonidan kattasi qisqartiriladi.

**144. Takroriy sarhisob** — QAROR KERAK
Shu guruhning shu oy sarhisobi bor bo'lsa — sariq ogohlantirish, saqlash to'xtamaydi va alohida yozuv bo'ladi (eski
panel ham shunday, ogohlantirishsiz). Yangisi eskisini almashtirsinmi yoki taqiqlansinmi? (Tahrirlash/o'chirish
API'si hozir yo'q.)

**145. Savollar soni kamaytirilsa** — qilindi
Undan katta natija qolsa saqlash to'xtaydi («N ta o'quvchining natijasi savollar sonidan ko'p»). Eski panelda bunday
natijalar jimgina saqlanmay qolardi (u yerda o'zgartirilmadi).

**146. Topshiriq tafsiloti, Jarimalar, Statistika, Sozlamalar** — taxmin
Rasmi yo'q: qator bosilsa eski batafsil panel (tarix, muddat chizig'i) ochiladi, undagi «Tahrirlash» — yangi oyna;
Jarimalar, Statistika, «Jarima va muddatlar» — «⋯» dan eski tablar (`/tasks?tab=…`), ulardagi «Topshiriqlar» tabi
yangi ro'yxatga qaytaradi. Batafsil panelda holat hali «Yangi» deb yozilgan (eski ko'rinish).

**147. Kartaning brend rangi** — taxmin (123 bilan bitta)
Rasmda «Faol» kartasi `brand-bg` fonda, jadvalda esa hamma holatlar bor — demak tanlov emas. Karta faqat filtri
yoqilganda shu rangda.

**148. «O'quvchi qo'shish»** — taxmin
Yangi versiyaning «Yangi o'quvchi» paneli (4-qism) shu guruh tanlangan holda ochiladi; saqlangan o'quvchi jadvalga
«Yangi» belgisi bilan qo'shiladi (eski Imtihon oynasi o'rniga).

### 9-qism — O'quvchi sahifasi (23.10.2026)

**149. Qarz qoidasi (O'quvchi sahifasi)** — QAROR KERAK
Har oy uchun to'lanadigan summa — guruhning oylik narxi; oy o'rtasida qo'shilgan/chiqqan oyda — darslar ulushi
(oylik × a'zolik darslari / oyning darslari). Qarz = joriy oygacha (shu oy butunligicha) hisoblangan − shu oylar uchun
to'langan («Qaysi oy uchun»), SOF: bir oyda ortiqcha to'langani (masalan 5-iyunda qo'shilib iyunni to'liq to'lagan)
boshqa oy qarzidan ayriladi — Qarzdorlar hisobotidagi (20.09 kelishuvi) kabi. Hisobotdan farqi: u bugungacha o'tgan
darslarni sanaydi va oyni 13 dars deb oladi, sahifa esa joriy oyni butunligicha va oyning haqiqiy darslari bilan —
oy o'rtasida raqamlar farq qiladi (ko'zguda: hisobotda 307 687, sahifada 400 000). «Oylar bo'yicha» jadvalida har oy o'z
to'lovi bilan («+49 231 ortiqcha»), farq izohda («ortiqcha to'langan … qarzdan ayrildi»). Rasmdagi «Balans −470 000» =
to'langan − to'lanishi kerak; O'quvchilar ro'yxatidagi «Balans» ustuni esa hamon to'lovlar yig'indisi (profildan
ochilgan to'lov oynasida — profil balansi). Variantlar: (a) shunday qolsin; (b) qisman oy ham to'liq oylik narxda;
(c) ortiqcha to'lov boshqa oy qarzini kamaytirmasin (faqat oyma-oy).

**150. «Tahrirlash» oynasi** — taxmin
Rasm yo'q — «Yangi o'quvchi» paneli qolipida: Ism, Familiya, Telefon, Qo'shimcha telefon, Tug'ilgan sana, Kategoriya,
Ota-ona (otasi va onasi — ism, telefon). Faqat o'zgargan maydonlar yuboriladi (tegilmagan telefon bazadagi shaklida
qoladi). «Tug'ilgan sana · Qo'shish» va «+ Ota-ona qo'shish» shu oynani o'sha maydonga fokus bilan ochadi. Qolgan
maydonlar (manzil, o'qish joyi, izoh, sinf, email …) — eski profilning «Tahrirlash» tabida («⋯» → «Eski ko'rinishda
ochish»).

**151. Tarix tabi** — taxmin
Rasm yo'q — «So'nggi harakatlar»ning to'liq ro'yxati, oy bo'yicha bo'lingan, segment «Hammasi | To'lovlar | Davomat |
Guruh va holat», 40 tadan. Manba — mavjud ma'lumot (eski «Harakatlar tarixi» `pupil_activity` hech qachon yozilmaydi):
to'lovlar (bir kunda bir oy uchun bir turda bir kassaga — bitta qator «2 ta to'lov · 620 000 so'm», rasmdagidek),
qoldirilgan / kechikkan / birinchi darslar (har «keldi» tarixga chiqmaydi), guruhga qo'shilish va chiqish, holat
o'zgarishi, ro'yxatga olingan kun.

**152. Guruh yonidagi belgi** — taxmin
Rasmda guruh yonida «Aktiv»; Guruhlar ro'yxati va DESIGN.md da guruh holati «Faol» (`GROUP_TONE`) — bir xil bo'lsin deb
«Faol». O'quvchining o'z holati «Aktiv» (o'quvchi holatlari ro'yxati).

**153. To'lov qaysi guruhniki** — taxmin
Kirim yozuvida guruh yo'q (`group: ""`), faqat ustoz — to'lov o'quvchining guruhlaridan ustozi shu bo'lgan YAGONA
guruhga; o'quvchining bitta guruhi bo'lsa — o'shanga. Aniqlanmasa tarixda «—», hisobda o'sha oyning qarzlariga guruhlar
tartibida taqsimlanadi (taqsimlanmay qolgani izohda).

**154. Narxi kiritilmagan guruh** — taxmin
Ko'zguda 4-filial guruhlarida kurs narxi yo'q. Bunday guruhning oylari hisoblanmaydi va unga yozilgan to'lov qarzga
qarshi qo'yilmaydi (aks holda «oldindan to'langan» bo'lib ko'rinardi); sahifa «Hisob to'liq emas: … — narx
belgilanmagan» deydi, narxli guruh umuman bo'lmasa balans va qarz «—». Havola — Sozlamalar → Kurslar.

**155. Davomat «belgilanmagan»** — taxmin
O'tgan dars kuni belgisiz bo'lsa — kalendarda uzuq chegarali «?» chip, Umumiy'da «?» doiracha; foiz faqat
belgilanganlardan («7 / 9 dars»). Belgi umuman yo'q oyda «Qoldirilgan darslar» — «Davomat belgilanmagan». Dars kunlari
guruh jadvalidan (bayram kunlari ham — hisobot qoidasi).

**156. Eski tablar va havolalar** — taxmin
Parol, SMS tarixi, qo'ng'iroqlar, vazifalar, shartnomalar — «⋯» dan eski ko'rinishda (`?classic=1&tab=…`). Eski
havolalar: `?tab=tranzaksiya` → To'lovlar, `harakatlar` → Tarix, `guruh` → Umumiy; qolgan eski tablar va buyurtma
(demo) id'lari — eski sahifa. Eski tizim (edutizim) to'lovlari — To'lovlar tarixi ostida havola.

**157. O'quvchini o'chirish** — taxmin
«⋯ → O'quvchini o'chirish» faqat to'lovi yo'q o'quvchida (server ham rad etadi — to'lovlar yetim qolardi); to'lovlida
band o'chiq, izohi «Holatni o'zgartirish orqali arxivlang».

**158. Guruh qatori amallari** — taxmin
«⇄ Ko'chirish» — guruh sahifasidagi bilan bir xil (yangisiga qo'shib, eskisidan chiqaradi; ikkinchi qadam o'tmasa —
aytiladi). «⋯» — Guruh sahifasi, Shu guruh uchun to'lov, Guruhdan chiqarish (tasdiq bilan). Chiqib ketgan guruhlar —
«Oldingi guruhlar (N)» ostida. Yig'ilayotgan guruhda narx o'rniga «qo'shilgan · sana» (rasmdagidek). SMS, holat va
guruh tanlash oynalari hozircha eski.

**159. «Shu oyni to'lash →» va «To'lash»** — qilindi
To'lov oynasi guruh, oy va o'sha oyning qolgan qarzi bilan ochiladi (summa o'zgartirilmasa yopishda tasdiq so'ralmaydi);
Umumiy'dagi «To'lash» — eng eski qarzli oy, guruhlar tartibida birinchisi. Oynadagi «Balans» — profil balansi.

### 10-qism — Guruh sahifasi (24.10.2026)

**160. Guruh holati yorlig'i** — taxmin
Rasmda «Aktiv»; Guruhlar ro'yxati va O'quvchi sahifasidagidek «Faol» (`GROUP_TONE`, 152 bilan bir xil).

**161. Belgilanmagan dars — hammasi «Keldi»** — taxmin
Belgisiz dars (bugungi yoki o'tgan — kim o'zgartira olsa) hamma o'quvchi «Keldi» bo'lib ochiladi, lekin bu QORALAMA:
«Saqlash»gacha bazaga hech narsa yozilmaydi (holat «Belgilanmoqda», pastda «Davomat hali saqlanmagan»). «Saqlash»
belgilarni bitta-bitta yozadi (eski jadvaldagi so'rov: tarix, gamifikatsiya, o'quvchilar boti xabari), jarayon
«Saqlanmoqda… 3/11». O'zgartirish huquqi yo'q darsda (ustoz — dars kunidan keyin) qoralama yo'q: faqat saqlangan
belgilar, belgisizi — «Belgilanmagan». Kelgusi dars — «Rejada», belgilanmaydi.

**162. Kechikdi va birinchi dars** — taxmin
Bugungi darsda uchta tugma (rasmdagidek); kechikib kelgan / birinchi darsi bo'lgan o'quvchi «Keldi» bo'lib ko'rinadi,
ism yonida kichik «kechikdi» belgisi, o'zgartirilmasa holati saqlanadi. Bu holatlarni Davomat jurnalidagi katak
menyusidan qo'yish mumkin (Keldi, Kechikdi, Kelmadi, Sababli, Birinchi dars, Belgini olib tashlash).

**163. Izoh ustuni** — qilindi
Izoh — darsda yo'q o'quvchida (kelmadi, sababli). Avval server izohni faqat «sababli»da saqlardi — endi «kelmadi»da ham
(lib/attendanceWrite.ts); sabab (ro'yxatdan) — faqat sababli. Holatni o'zgartirish cheklangan darsda ham izohni yozish
mumkin (server ilgari ham ruxsat berardi).

**164. «Tanga berish» bandlari** — taxmin
«Darsda faol qatnashdi» — faollik (sukut 2, oraliq 1 … bir bosishdagi chegara); «Uy vazifasini bajardi / bajarilmadi» —
tizim sabablari (miqdori Sozlamalarda, uy vazifasi bitta: ikkinchisi birinchisini almashtiradi); qolganlari —
Sozlamalar → Tanga sabablari (rolga ruxsatlilari, kunlik chegarasi tugagani o'chiq). «Yoki boshqa miqdor» — tanlangan
band oralig'ida. Izoh — faqat qo'shimcha sababda (ayiriladiganida majburiy). Darsda yo'q o'quvchiga — faqat beriladigan
sabablar. Faollik va uy vazifasi — faqat guruh ustozi (va direktor).

**165. O'quvchilar tabi** — taxmin
Rasm yo'q — yangi jadval qolipida: №, O'quvchi (profilga havola, muzlatilgani belgisi bilan), Telefon (qo'ng'iroq),
Qo'shilgan, Davomat · joriy oy (70% dan past — qizil), Tanga, «⋯» (Profil, Boshqa guruhga ko'chirish, Guruhdan
chiqarish). Qidiruv — ism yoki telefon. Eski jadvaldagi Balans, Narxi, «Oxirgi izoh» — eski ko'rinishda.

**166. Eski tablar va havolalar** — taxmin
Topshiriqlar, Mashg'ulot qo'shish, Guruh tarixi — «⋯» dan eski ko'rinishda (`?classic=1&tab=…`; eski sahifada tab
almashganda ham `classic=1` qoladi). Eski havolalar: `?tab=attendance` → Davomat jurnali, `students` → O'quvchilar.

**167. Tanga faqat bugungi darsda** — qoida
Gamifikatsiya qoidasi (server ham shunday): tanga faqat bugungi darsda va davomat saqlangandan keyin — «+ Tanga»
bosilganda o'quvchining saqlanmagan belgisi avval saqlanadi. Chip bosilsa «Ortga» (tasdiq bilan) — o'zi qo'ygan bugungi
yozuv, direktor — hammasi; davomat, seriya, sarhisob tangalari avtomatik — qaytarilmaydi (chip bosilmaydi). Guruh faol
bo'lmasa yoki xodimning gamifikatsiya roli yo'q bo'lsa tanga ustunlari chiqmaydi.

**168. «Dars boshlanganiga 7 daqiqa»** — taxmin
Guruh vaqti bo'yicha (Toshkent vaqti, daqiqada yangilanadi): «Dars boshlanishiga …», «Dars boshlanganiga …», tugagach
«Dars tugagan»; boshqa kunlarda «N kun oldin» / «N kundan keyin». Sarlavhada «Bugun / Kecha / Ertaga».

**169. Jurnal hisoblari** — taxmin
Foiz = kelgan (keldi, kechikdi, birinchi dars) / belgilangan dars (sababli ham maxrajda — rasmdagi 4/5 = 80%); o'tgan
darslar — bugungacha (bugun ham). «Diqqat talab» — foizi 70% dan pastlar (eng pasti nomi bilan). Qo'shilishidan oldingi
kunlar va muzlatilgan o'quvchining belgisiz darslari — bo'sh katak.

**170. «Tanga · okt» va «Berilgan tanga»** — taxmin
Shu guruhda shu oy yozilgan tangalar yig'indisi (do'kondan tashqari, bekor qilinganlarsiz; ayirilgani ham hisobda) —
`GET /api/gamification/lesson?month=` (yangi maydon `monthCoins`).

**171. Saqlanmagan belgilar** — qilindi
O'zgartirilgan, saqlanmagan belgilar bilan boshqa darsga yoki tabga o'tishda tasdiq so'raladi («Saqlamasdan o'tish»),
sahifani yopishda brauzer ogohlantiradi. Jurnal kataklari darhol yoziladi (xato bo'lsa qaytadi).

### 11-qism — Gamifikatsiya: Reyting, Do'kon, Tanga qoidalari (24.10.2026)

**172. «So'rov» nima** — taxmin
Alohida «so'rov yuborish» tugmasi tizimda yo'q edi — so'rov = o'quvchi kabinetida «♡ Istakka» qo'shgan sovg'asi, TANGASI
YETADIGANI (yetmagani hali maqsad: «Yana N ta istak — tanga yetguncha kutadi» deb sanaladi). Kabinetdagi yozuv «Tanga
yetadi — filial adminiga murojaat qil» → «Tanga yetadi — so'rovingiz adminga yuborildi». Kabinetga alohida «So'rov
yuborish» tugmasi kerak bo'lsa — keyin.

**173. Tasdiqlash va topshirish** — taxmin
«Tasdiqlash» — oddiy berish (tanga darhol ayiriladi, ombor −1, byudjet); buyum va xizmat «Topshirish kutilmoqda» ga
tushadi, o'quvchi kabinetida «Tasdiqlandi — markazdan olib ketishingiz mumkin»; «Topshirildi» bosilgach tarixga o'tadi.
To'lovga chegirma — kurs tanlash oynasi, topshirish bosqichisiz (to'lovga qo'llanadi). Eski «Berish» (profil, katalog
«⋯ → O'quvchiga berish») — o'sha payt qo'lga berilgan hisoblanadi. «⋯ → Bekor qilish» — eski qaytarish (tanga va ombor
qaytadi; admin — shu kuni, direktor — istalgan payt).

**174. Rad etish** — taxmin
Sabab majburiy (300 belgigacha); istak olinadi (o'quvchi yana ♡ qilishi mumkin), tanga joyida; sabab o'quvchi kabinetida
30 kun ko'rinadi («✕ Kepka — so'rov rad etildi: …»). Yozuv — yangi to'plam `shop_request_rejections`.

**175. Tarix** — taxmin
«Tarix: topshirilgan va rad etilganlar →» — o'ng tomondan oyna, oxirgi 90 kun: topshirilgan (eski berilganlar ham),
rad etilgan (sababi bilan), qaytarilgan (izohi bilan); huquq bo'lsa «Sovg'ani qaytarish».

**176. Eski do'kondagi qolganlar** — taxmin
Byudjet kartasi, «Keyingi oy chegirmalari», istaklar statistikasi, filial tanlovi — «⋯ → Eski ko'rinishda ochish».
Direktor — navbardagi filial (1+2 hovuzi bilan), admin — o'z filiallari; ustozga So'rovlar ko'rinmaydi (faqat katalog).

**177. Sovg'a ikonkasi** — taxmin
Rasmdagi chiziqli ikonkalar — sovg'a nomidan (bloknot, ruchka, futbolka, krujka, kitob, powerbank, sumka …; topilmasa —
🎁 ikonkasi, chegirma — %); rasm yuklangan bo'lsa — rasm. Eski emoji belgisi yangi ko'rinishda ishlatilmaydi.

**178. Reyting doirasi va «Umumiy»** — taxmin
Navbardagi filial bo'yicha (xodimning guruhlari: direktor/admin — filial, ustoz — o'z guruhlari). «Guruh: Hammasi» —
o'quvchining shu oydagi hamma tangalari; guruh tanlansa — shu guruhdagi tangalar (eski guruh reytingi qoidasi). Oylik —
olingan − ayirilgan (do'kon xaridi kirmaydi); Umumiy — hozirgi balans (rasmdagi izoh bo'yicha; eski «Jami» — guruhdagi
umrbod tangalar edi). Teng tangalilar bir xil o'rin.

**179. Uchlik** — qoida
Uchlik, 👑 va «1» belgisi faqat tangasi 0 dan katta bo'lsa (27.09 qarori — hamma 0 da hammaga «1-o'rin» chiqmasin).

**180. O'tgan oylar g'oliblari** — taxmin
Oldingi 3 oyning har birida eng ko'p tanga olgan (shu doira va filtr bo'yicha, jonli hisob); 0 bo'lsa — chiqmaydi.

**181. «Ekranga chiqarish»** — taxmin
Rasmda yo'q, lekin ishlatiladigan imkoniyat — sarlavhada ikonka tugma (eski proyektor oynasi, top-5, kosmik fon).

**182. Tanga qoidalari** — taxmin
Jadval — ustoz darsda tanlaydigan ro'yxat (guruh sahifasidagi «Tanga berish» bilan bir xil tartib): «Darsda faol
qatnashdi» (miqdori «+1…+3» — bir bosishdagi chegara; rasmda «+2» — tanga oynasidagi sukut), «Uy vazifasini bajardi»,
qo'shimcha sabablar, «Uy vazifasi bajarilmadi». Tizim qoidalari 🔒 (o'chirilmaydi); qo'shimcha sababda nom ostida kim
beradi / kuniga necha marta / izoh majburiyligi. Avtomatik tangalar (davomat, seriya, Sarhisob, do'st) — yig'iq
bo'limda. Modulni yoqish, darajalar, do'kon va byudjet sozlamalari — eski ko'rinishda (havola). Tahrir oynalari — eski.

**183. Yon menyudagi Gamifikatsiya** — ochiq
Rasmda faqat «Reyting» va «Do'kon». Hozircha «Tanga berish», «O'quvchilar», «Guruhlar musobaqasi» ham turibdi (eski
sahifalar; tanga berish endi guruh sahifasida ham bor). *Taxmin:* qoldi — olib tashlash kerak bo'lsa ayting.

**184. Inglizcha tarjima to'qnashuvlari** — qilindi
Lug'at bitta kalit — bir ma'no: «Oylik» = "Salary" bo'lgani uchun izohda «Oylik reyting» / «Umumiy reyting» yozildi;
«Umumiy» segmenti inglizchada "General", «Tugagan» — "Finished" bo'lib qoldi (kichik farq).

### 12-qism — Imtihon → UzBMB: natija kiritish, natijalar va taqqoslash, Excel eksport, Imtihon fanlari (25.10.2026)

**185. UzBMB ma'lumoti: test → guruh → natija** — taxmin
Eski UzBMB oynasi natijani o'quvchi ISMI va OY bo'yicha saqlardi (bazada 3 ta yozuv, avgust). Rasmda — test («UzBMB sinov
testi №3»), sana, guruh, yo'nalish. Yangi tuzilish: test (filial bo'yicha №1, №2 …, nomi va sanasi) → guruh varag'i →
o'quvchi natijasi (bitta testda o'quvchiga bitta natija). Natija eski to'plamga (`uzbmb_exams`) eski maydonlari bilan
yoziladi — o'quvchilar boti va kabinet ko'rsataveradi (endi o'quvchi ID bo'yicha: ism o'zgarsa ham topiladi, ismdoshniki
chiqmaydi). Testga bog'lanmagan 3 ta eski natija — jadval ostidagi «Eski natijalar» havolasi orqali eski ko'rinishda.

**186. Test** — taxmin
«Test» ro'yxati ostida «+ Yangi test» (nomi ixtiyoriy — sukut «UzBMB sinov testi №N», sana) va «Testni tahrirlash» (nomi,
sanasi; natijasi yo'q testni o'chirish). Raqam navbardagi filial (1+2 hovuzi bilan) bo'yicha ketma-ket. Ball tuzilishi test
yaratilganda sozlamadan olinadi — sozlama keyin o'zgarsa eski testlar o'zgarmaydi (rasmdagi «o'zgarsa, faqat yangi testlarga
ta'sir qiladi»). «Sana» — guruh testni topshirgan kun (sukut — test sanasi).

**187. «Yo'nalish · avto»** — taxmin
Bazada «Abituriyent · Biologiya–Kimyo» kabi guruh yo'q — kurslar fan bo'yicha (Biologiya · 9-11-sinflar …). Avto tartib:
shu testda shu guruh bilan saqlangan yo'nalish → guruhning oxirgi yo'nalishi (boshqa testda) → guruh nomida ikki blok fani
bo'lsa → guruh kursi blok fani bo'lsa 1-blok, 2-blok odatiy juftidan (Biologiya↔Kimyo, Matematika↔Fizika,
Geografiya→Matematika); topilmasa — tanlash so'raladi. Yo'nalish ballga ta'sir qilmaydi, fanlar tahlili shundan.

**188. Guruhda boshqa yo'nalishli o'quvchi** — taxmin
Varaqda yo'nalish bitta. O'quvchining saqlangan natijasi boshqa yo'nalishda bo'lsa — o'z fanlarida qoladi (ismi ostida
sariq «Matematika — Fizika yo'nalishi»), tahrirlansa ham. Varaq yo'nalishi o'zgartirilsa, shu yo'nalishdagi saqlangan
natijalar yangisiga o'tadi. Har o'quvchiga alohida yo'nalish tanlash kerak bo'lsa — keyin.

**189. Sertifikat** — taxmin
Faqat 1-blok va 2-blok fanida (eski tizimdagidek): katakdagi belgini bosib, ball qo'lda (0–93 / 0–63, bitta kasr),
koeffitsiyent qo'llanmaydi; fanlar bo'yicha o'zlashtirishga kirmaydi. Majburiy fanlarga sertifikat yo'q — kerak bo'lsa keyin.

**190. To'liq kiritilmagan natija** — taxmin
Saqlanadi («natija to'liq kiritilmagan»), lekin reytingga, o'rtachaga va o'quvchilar botiga chiqmaydi. Qator butunlay
bo'shatib saqlansa — natija o'chadi. Saqlashda faqat o'zgargan qatorlar yuboriladi.

**191. «O'quvchi qo'shish»** — taxmin
Qidiruv bilan mavjud o'quvchini SHU TESTGA qo'shish (guruh tarkibi o'zgarmaydi — boshqa guruhdan yoki tashqaridan kelgan);
«Yangi o'quvchi» — Sarhisobdagidek yangi o'quvchi oynasi (guruhga ham qo'shiladi). Bitta testda bitta natija: boshqa guruh
varag'ida tahrirlab saqlansa, natija o'sha guruhga o'tadi (ismi ostida «… bilan saqlangan»).

**192. Taqqoslash hisoblari** — taxmin
«Bu guruh · №3» — guruhning to'liq natijalari o'rtachasi; «Filial o'rtachasi · №3» — shu testdagi barcha to'liq natijalar;
«Bu guruh · №2 test» — shu o'quvchilarning oldingi testdagi o'rtachasi; «№2 testdan» — o'quvchining oldingi test jami
baliga farqi. Fanlar bo'yicha o'zlashtirish — to'g'ri javoblar ulushi; eng pasti 80% dan past bo'lsa sariq va ostida
ogohlantirish. Ball oralig'i ≥ 150 / 120–149 / < 120 (189 dan; tuzilish boshqa bo'lsa mutanosib). Qator bosilsa — o'quvchining
UzBMB testlari (o'sish bilan), «← Taqqoslash».

**193. Excel'dan yuklash** — taxmin
Natijani JADVALGA qo'yadi (saqlamaydi) — tekshirib, «Natijalarni saqlash». Shablon — guruh o'quvchilari bilan (.xlsx); ism
bo'yicha moslanadi (ism-familiya va teskarisi), sertifikat — alohida ustunda. Natijalar ko'rinishida bosilsa — kiritishga
o'tib qo'yadi. Topilmagan ismlar va chegaradan oshganlar oynada aytiladi.

**194. Eksport** — taxmin
.xlsx: «Shu guruh» — varaqdagi o'quvchilar (kiritilmaganlari ham), «Barcha guruhlar» — shu testning filialdagi hamma natijasi
(Guruh ustuni bilan); «Fanlar bo'yicha to'g'ri javoblar» va «Sertifikat belgilari» — qo'shimcha ustunlar. Faqat saqlangan
natijalar.

**195. Imtihon fanlari sozlamasi** — taxmin
Umumiy (barcha filiallar). Majburiy uchtasi qulf — nomi o'zgarmaydi, o'chirilmaydi, faqat «blokda ham» belgisi (Matematika —
sukut bilan). Blok fanlari — qo'shish, tahrirlash, faolsizlantirish (yo'nalishda chiqmaydi), o'chirish (oldingi natijalarda
nomi qoladi). Boshlang'ich ro'yxat — eski oynadagi 10 blok fani (rasmdagi «Namuna» kartasida 4 tasi). Kim o'zgartiradi —
Sozlamalar → O'quv ruxsati bor xodim (`/settings-academic?tab=exam-subjects`). Ball tuzilishi «Saqlash» qatori bilan.

**196. «Namuna» belgisi va eski ko'rinish** — qoida
«Namuna» — dizayner izohi, ko'rsatilmaydi (8-qismdagidek). Eski versiyadagi UzBMB oynasi o'zgarmadi: u yangi natijalarning
to'liqlarini ham ko'radi, ism + oy bo'yicha almashtirishi esa faqat testsiz eski yozuvlarga tegadi.

**197. Yo'lakay tuzatishlar** — qilindi
Sarhisob «Natija kiritish»dagi chiqish tasdig'i — «Chiqish» inglizchada "Log out" chiqardi → «Saqlamasdan chiqish». Sozlamalar
ramkasida uzun sahifa kartalari siqilib kesilardi (Imtihon fanlarida ko'rindi; Tanga qoidalarida ham shu xavf) — tuzatildi.

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
