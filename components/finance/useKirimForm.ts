"use client";

import { loadBalancesByIdCached } from "@/lib/balancesClient";
import { invalidateBalances, invalidateTransactions } from "@/lib/cacheKeys";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { groupNumber } from "@/components/ui/MoneyInput";
import { useTeachers } from "@/hooks/useTeachers";
import type { StudentRow } from "@/lib/studentsData";
import type { TransactionType } from "@/lib/transactionTypes";
import { txAudience } from "@/lib/txTarget";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";
import { useT } from "@/components/shared/Language";
import { monthsInNote, nearestMonthKey } from "@/lib/noteMonth";

// KASSAGA KIRIM — ma'lumot va mantiq, ESKI oyna (./CashboxKirimDrawer.tsx) va
// YANGI versiya formalari («To'lov qabul qilish», «Kassa amali → Kirim»,
// components/v2/finance/) uchun BITTA manba. 19.10.2026 da eski oynadan izohlari
// bilan AYNAN ko'chirildi: tekshiruvlar, «Qaysi oy uchun», izohdagi oy qorovuli,
// tanga chegirmasi va so'rov tanasi o'zgarmadi. Faqat muvaffaqiyatdan keyingi
// ish (toast, oynani yopish) chaqiruvchida — `onSuccess` (yangi oynalar chek
// tugmasi uchun `entryId` ham oladi).

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Sanadan "YYYY-MM". Sana bo'lmasa — bugungi oy. */
function monthOf(d: Date | null): string {
  const x = d ?? new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}

/** "2026-09" -> "09/2026" — Izohga yoziladigan ko'rinish. */
function monthLabel(m: string): string {
  return m.length === 7 ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : m;
}

/**
 * "Uchinchi shaxs" turidagi kirimning bitta qatori: qiymat + qaysi oy.
 *
 * Qatorlar KALKULYATOR — ular alohida jurnal yozuvi yaratmaydi, bitta
 * yozuvga yig'iladi (sabab `save()` izohida).
 */
/**
 * `/api/gamification/discounts/pending` javobi (lib/gamification/discounts.ts →
 * PendingDiscount). Tip server modulidan import qilinmaydi: u Mongo
 * kodini tortadi va ruxsatlar generatori importlarni kuzatadi.
 */
interface PendingDiscount {
  id: number;
  month: string;
  percent: number;
  amountSom: number;
  groupLabel: string;
  teacherName: string;
  inGroup: boolean;
}

interface Row {
  id: number;
  amount: string;
  periodMonth: string;
}

// Kassalar sahifasidagi "+ Kirim" — referens saytdagi (edutizim.uz) oyna
// bilan bir xil maydonlar: Tranzaksiya (kategoriya), O'qituvchi, O'quvchi,
// Qiymat, To'lov turi, Sana, Izoh. Pul harakati (methodTotals/balance)
// /api/cashboxes/:id/adjust orqali HAQIQIY, kategoriya/o'qituvchi/o'quvchi/
// sana/izoh bilan birga — shu amal "Tranzaksiyalar" va "Moliya
// hisobotlari/analitikasi" sahifalari ko'radigan haqiqiy jurnalga yoziladi.
// "Tranzaksiya" ro'yxati — Moliya → Tranzaksiya turi (/finance-tx-types)
// sahifasidagi HAQIQIY, admin boshqaradigan ro'yxatdan (mainType: "kirim").

export function useKirimForm({
  cashbox,
  students,
  initialStudentKey,
  initialTeacherName,
  preferType,
  onSuccess,
}: {
  cashbox: Cashbox;
  students: StudentRow[];
  initialStudentKey?: string;
  /** Boshlang'ich o'qituvchi (yangi «To'lov qabul qilish»: tanlangan guruhning ustozi). */
  initialTeacherName?: string;
  /** Sukut tur (yangi «To'lov qabul qilish»: o'quvchi to'lovi turi). Berilmasa — ro'yxatdagi birinchisi (eskisidek). */
  preferType?: (kirimTypes: TransactionType[]) => TransactionType | undefined;
  onSuccess: (data: { cashbox: Cashbox; entryId?: number }) => void;
}) {
  const { t, months } = useT();
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const { showError } = useToast();
  // O'qituvchi ro'yxati bazadan — bu qiymat tranzaksiyaga yoziladi va
  // ISM bo'yicha oylik hisobiga ulanadi (lib/payrollSources.ts), shu bois
  // qattiq ro'yxatdagi ism tushumni hech kimga biriktirmasdi.
  const { teachers, names: teacherNames, loading: teachersLoading } = useTeachers();
  // Tanlangan tur ID bo'yicha saqlanadi, NOM bo'yicha emas — turning
  // "Mijoz" (`customerType`) maydoni ham kerak. Bu Chiqim oynasidagi
  // bilan bir xil qoida (CashboxAdjustDrawer): u yerda ilgari
  // `.map((tv) => tv.name)` turgan va maydon aynan o'sha qatorda
  // yo'qolardi — javobda bor edi, lekin brauzergacha yetib kelmasdi.
  // Serverga baribir NOM ketadi: jurnal va analitika nom bo'yicha
  // guruhlanadi.
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [teacherName, setTeacherName] = useState(initialTeacherName ?? "");
  // `preferType` ref'da — turlar effekti faqat kassa almashganda qayta yuradi
  // (chaqiruvchining har chizishdagi yangi funksiyasi so'rovni takrorlatmasin).
  const preferTypeRef = useRef(preferType);
  useEffect(() => { preferTypeRef.current = preferType; }, [preferType]);
  // TANLANGAN O'QUVCHI — ID (satr ko'rinishida), ISM EMAS.
  //
  // NIMA NOTO'G'RI EDI: bu yerda ism turardi va ro'yxat ham ismlardan
  // tuzilardi. Bazada 545 ta ism takrorlanadi — ismdosh ikki bola
  // ro'yxatda BITTA qator bo'lib ko'rinardi, tanlanganda esa xaritadan
  // har doim BIRINCHISI olinardi. Ya'ni kassir ikkinchi bolaga to'lov
  // yozsa ham pul birinchisining hisobiga tushardi — foydalanuvchi aynan
  // shundan shikoyat qildi (23.09.2026, lib/pupilEntries.ts).
  const [studentKey, setStudentKey] = useState(initialStudentKey ?? "");
  // Bo'sh boshlanadi — ilgari maydonda "0" turar va uni har safar
  // o'chirishga to'g'ri kelardi.
  const [amount, setAmount] = useState("");
  // O'quvchilar balansi (haqiqiy to'lovlar yig'indisi) — tanlash
  // ro'yxatida va tanlangandan keyin ko'rsatiladi.
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  // QAYSI OY uchun tolov. Sana — pul KELGAN kun, bu esa tolov qaysi
  // davrga tegishli ekani: sentabrda kelgan pul avgust darslari uchun
  // bolishi mumkin. Sukut — tanlangan sananing oyi, yani odatdagi holatda
  // kassir hech narsa qilmaydi.
  const [periodMonth, setPeriodMonth] = useState<string>(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
  // Oy QO'LDA tanlanganmi. Tanlangan bo'lsa, sana o'zgarganda u endi
  // sananing oyiga qaytib ketmaydi (02.10.2026 gacha qaytib ketardi:
  // avval «Avgust» tanlab, keyin sanani bosgan kassirning to'lovi jimgina
  // sentabrga yozilardi).
  const [periodTouched, setPeriodTouched] = useState(false);
  // "Uchinchi shaxs" turidagi kirim qatorlari (Qiymat + Oy). Boshqa
  // turlarda ishlatilmaydi — u yerda yuqoridagi bitta `amount` qoladi.
  const [rows, setRows] = useState<Row[]>(() => [{ id: 1, amount: "", periodMonth: monthOf(null) }]);
  const [nextRowId, setNextRowId] = useState(2);
  const [note, setNote] = useState("");
  // Shu kassada ILGARI yozilgan izohlar — "Izoh" maydonidagi tavsiyalar
  // (tez-tez ishlatilgani birinchi, server shunday saralaydi).
  const [noteOptions, setNoteOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<TransactionType[]>([]);
  // Tranzaksiya turlari xom `fetch` bilan olinadi (hook yo’q), shuning
  // uchun yuklanish holati shu yerda yaratiladi.
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const key = (n: string) => n.trim().toLowerCase();
  // Ro'yxat variantlari — o'quvchi ID'lari; ko'rinadigan matn `labelOf`
  // orqali beriladi (components/orders/StudentSearchSelect.tsx).
  const studentById = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const s of students) map.set(String(s.id), s);
    return map;
  }, [students]);
  const studentOptions = useMemo(() => students.map((s) => String(s.id)), [students]);
  const nameOf = (k: string) => studentById.get(k)?.name ?? "";
  const phoneOf = (k: string) => {
    const s = studentById.get(k);
    return s?.phone ? `+998 ${s.phone}` : "";
  };
  // O'qituvchi telefoni — tanlash ro'yxatidagi ikkinchi satr. Qidiruv shu
  // satrni ham qamrab oladi (StudentSearchSelect → haystackOf), shuning
  // uchun o'qituvchini telefon raqami bo'yicha ham topsa bo'ladi.
  const teacherByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const tv of teachers) {
      const k = key(tv.name);
      if (!map.has(k)) map.set(k, tv.phone ? `+998 ${tv.phone}` : "");
    }
    return map;
  }, [teachers]);
  const teacherPhoneOf = (n: string) => teacherByName.get(key(n)) ?? "";
  const balanceOf = (k: string) => balances[Number(k)] ?? 0;
  const selectedStudent = studentKey ? studentById.get(studentKey) : undefined;
  const selectedBalance = studentKey ? balanceOf(studentKey) : 0;
  // Serverga NOM ham ketadi — jurnaldagi "KIM" ustuni, Sheets va
  // Telegram xabari shuni ko'rsatadi. Bog'lanish esa ID bo'yicha.
  const studentName = selectedStudent?.name ?? "";

  // TANGA EVAZIGA CHEGIRMA (gamifikatsiya, TZ 4.16.4) — o'quvchi shu oy
  // to'loviga chegirma olgan bo'lsa, kassir pulni olishdan OLDIN bilsin:
  // o'quvchidan shuncha kam olinadi, chegirma saqlanganda o'zi qo'llanadi
  // (lib/cashboxAdjust.ts). Javob pupil+oy kaliti bilan saqlanadi — tanlov
  // o'zgarsa eski ogohlantirish ko'rinmaydi.
  const [pendingDisc, setPendingDisc] = useState<(PendingDiscount & { key: string }) | null>(null);
  const discPupilId = selectedStudent?.id ?? null;
  const discKey = `${discPupilId}:${periodMonth}`;
  useEffect(() => {
    if (discPupilId === null) return;
    let alive = true;
    fetch(`/api/gamification/discounts/pending?pupilId=${discPupilId}&month=${periodMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setPendingDisc(d?.ok && d.discount ? { ...(d.discount as PendingDiscount), key: `${discPupilId}:${periodMonth}` } : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [discPupilId, periodMonth]);

  const selectedType = useMemo(
    () => categories.find((tv) => tv.id === categoryId) ?? null,
    [categories, categoryId],
  );
  // Serverga NOM ketadi — jurnal/analitika nom bo'yicha guruhlaydi.
  const category = selectedType?.name ?? "";
  // QAYSI TANLOVLAR CHIQADI — qaror KODDA emas, Sozlamalar → Moliya →
  // Tranzaksiya turi formasidagi "Mijoz" KATAKCHALARIDA
  // (`transaction_types.customerType`, lib/txTarget.ts → txAudience).
  //
  // Ilgari bu yerda faqat "Uchinchi shaxsmi?" degan bitta savol bor edi va
  // undan boshqa HAR QANDAY turda ikkala tanlov ham chiqaverardi — ya'ni
  // "Imtihon to'lovi" da ham o'qituvchi so'ralardi. Endi har bir tur
  // o'ziga keragini aytadi.
  const audience = txAudience(selectedType);
  // Maydon UMUMAN to'ldirilmagan tur (masalan API orqali qo'shilgani) —
  // ikkala tanlov ham chiqadi. Bu ataylab: yozuvni egasiz qoldirgandan
  // ko'ra kassirga ortiqcha maydon ko'rsatgan yaxshi.
  const showTeacher = audience.unset || audience.employee;
  const showStudent = audience.unset || audience.student;
  // "Uchinchi shaxs" (masalan "Kitob sotuvi") — pul odamga bog'liq emas:
  // bitta "Qiymat" maydoni o'rniga (Qiymat + Oy) qatorlari chiqadi.
  const showRows = audience.thirdParty;
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // IZOHDAGI OY ≠ TANLANGAN OY (lib/noteMonth.ts izohi): kassir oyni izohga
  // yozib, «Qaysi oy uchun» ni o'zgartirmasa — ustoz ulushi boshqa oyga
  // tushadi. Faqat oy maydoni va o'qituvchi chiqadigan turda tekshiriladi
  // (aks holda `periodMonth` hech kimning oyligiga ta'sir qilmaydi).
  // 04.10.2026 dan MAJBURIY: farq bo'lsa «Saqlash» o'chiq (save() izohi).
  const noteMonthNums = useMemo(() => monthsInNote(note), [note]);
  const noteMismatch = !showRows && showTeacher && noteMonthNums.length > 0
    && !noteMonthNums.includes(Number(periodMonth.slice(5, 7)));
  // Izohda BITTA oy bo'lsa — bir bosishda o'shanga o'tkazish taklif qilinadi.
  const noteTarget = noteMismatch && noteMonthNums.length === 1 ? nearestMonthKey(noteMonthNums[0], periodMonth) : null;
  const monthName = (key: string) => `${months[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;

  /**
   * Tranzaksiya turini almashtirishning YAGONA darvozasi.
   *
   * NEGA YAGONA: turni ikki joydan o'zgartirish mumkin — `<select>` va
   * yonidagi "X" (tozalash) tugmasi. Ikkalasi ham shu yerdan o'tmasa,
   * "Kitob sotuvi" da to'ldirilgan qatorlar YASHIRINIB qoladi-yu
   * holatda saqlanib turadi va keyingi turda `total` ularni ham
   * qo'shib yuboradi — ya'ni kassaga kassir ko'rmagan pul kiradi.
   *
   * Shart `showRows` o'zgarishiga emas, tur ID siga bog'langan:
   * "Kitob → X → Kurs" yo'lida ikkala uchida ham `showRows === false`
   * bo'ladi va bayroqqa bog'langan qorovul ishlamasdi.
   */
  function pickType(next: TransactionType | null): void {
    if ((next?.id ?? null) === categoryId) return;
    setCategoryId(next?.id ?? null);
    setTeacherName("");
    setStudentKey("");
    setAmount("");
    setRows([{ id: 1, amount: "", periodMonth: monthOf(date) }]);
    setNextRowId(2);
    setPeriodMonth(monthOf(date));
    setPeriodTouched(false);
  }

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId, amount: "", periodMonth: monthOf(date) }]);
    setNextRowId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }
  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  useEffect(() => {
    let cancelled = false;
    loadBalancesByIdCached().then((b)=>{ if(!cancelled) setBalances(b); }).catch(()=>{});
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        // TURLAR TO'LIQ SAQLANADI. Ilgari bu yerda `.map((tv) => tv.name)`
        // turardi va turning "Mijoz" (`customerType`) maydoni aynan shu
        // qatorda yo'qolardi — javobda bor edi, lekin brauzergacha yetib
        // kelmasdi. Nom bo'yicha dedup ham olib tashlandi: endi kalit
        // `id`, ya'ni bir xil nomli ikki tur bir-birini yutmaydi.
        const kirim = (d.types as TransactionType[]).filter((tv) => tv.mainType === "kirim");
        setCategories(kirim);
        // Moliya → Tranzaksiya turi sahifasining "Kirim" tabida BIRINCHI
        // turgan tur avtomatik tanlanadi (tartib API'dagi id bo'yicha).
        if (kirim.length > 0) setCategoryId((cur) => cur ?? (preferTypeRef.current?.(kirim) ?? kirim[0]).id);
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });

    // Izoh tavsiyalari — SHU kassaning yozuvlaridan. Yiqilsa jim
    // o'tkaziladi: maydon oddiy input bo'lib ishlayveradi, ya'ni tavsiya
    // yo'qligi kirim qilishga to'sqinlik qilmaydi.
    fetch(`/api/transaction-entries/notes?cashboxId=${cashbox.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setNoteOptions(d.notes as string[]); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [cashbox.id]);

  async function save() {
    if (!category) {
      showError(t("Tranzaksiya turini tanlang"));
      return;
    }
    // Tanlov maydoni KO'RINIB TURGAN bo'lsa, u bo'sh qolmasin. Aks holda
    // yozuv egasiz tug'iladi: to'lov o'quvchi balansiga ham, o'qituvchining
    // foizli oyligiga ham tushmaydi va shunchaki nomsiz tushum bo'lib
    // qoladi. Chiqim oynasida bu qorovul allaqachon bor.
    if (showStudent && !studentKey) {
      showError(t("O'quvchini tanlang"));
      return;
    }
    // O'QITUVCHI faqat u YAGONA tanlov bo'lganda majburiy.
    //
    // Ikkalasi ham chiqqanda majburiy EMAS — bugungi xulq shunday va u
    // to'g'ri: "Kurs to'lovi (oylik)" da o'quvchi allaqachon yozuvning
    // egasi, o'qituvchi esa qo'shimcha (foizli oylik uchun) va guruhga
    // hali biriktirilmagan bo'lishi mumkin. Yagona tanlov bo'lgan holatda
    // esa uni bo'sh qoldirish yozuvni butunlay egasiz qilardi.
    if (showTeacher && !showStudent && !teacherName.trim()) {
      showError(t("O'qituvchini tanlang"));
      return;
    }
    // "Uchinchi shaxs" turida summa QATORLARDAN yig'iladi, boshqa
    // turlarda — bitta maydondan.
    const amountNum = showRows ? total : Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError(t("Qiymatni to'g'ri kiriting"));
      return;
    }
    if (!method) {
      showError(t("To'lov turini tanlang"));
      return;
    }
    // Izohda boshqa oy yozilgan — MAJBURIY (04.10.2026, foydalanuvchi:
    // "majburiy qil"): oy yoki izoh to'g'rilanmaguncha SAQLANMAYDI. Ilgari
    // ikkinchi «Saqlash» o'tkazib yuborardi va 03.10 da 20 ta «sentabr»
    // izohli kirim shu yo'l bilan oktabrga yozildi. Server ham rad etadi
    // (lib/cashboxAdjust.ts → noteMonthConflict).
    if (noteMismatch) {
      showError(t("Izohdagi oy «Qaysi oy uchun» maydonidagi oydan farq qiladi — oyni yoki izohni to'g'rilang"));
      return;
    }
    // BITTA YOZUV, YIG'INDI BILAN — qatorlar alohida jurnal yozuvi
    // YARATMAYDI. Sabab: `periodMonth` ni bu turda o'qiydigan iste'molchi
    // YO'Q — `loadCollectedByTeacher` (lib/payrollSources.ts) yozuvni
    // `teacherName` bo'yicha kesadi, uchinchi shaxs yozuvida esa u bo'sh.
    // Ya'ni N ta yozuvga bo'lish jurnalga N ta bir xil ko'rinadigan qator,
    // Sheets'ga N ta qator va guruhga N ta xabar berardi — farqi hech
    // qayerda ko'rinmasdi.
    //
    // Qatorlarning ma'lumoti Izohga MATN bo'lib tushadi va u to'rt joyda
    // ko'rinadi: jurnal "Izoh" ustuni, yozuv kartochkasi, Google Sheets
    // va Telegram xabari.
    const rowsNote = showRows && rows.length > 1
      ? rows.map((r) => `${monthLabel(r.periodMonth)}: ${groupNumber(Number(r.amount) || 0)}`).join("; ")
      : "";
    const finalNote = rowsNote ? (note.trim() ? `${rowsNote} · ${note.trim()}` : rowsNote) : note;

    setSaving(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "kirim",
          method,
          amount: amountNum,
          category,
          // EKRANDA KO'RINMAGAN QIYMAT YUBORILMAYDI. Tur almashtirilganda
          // `pickType()` maydonlarni tozalaydi, lekin bu ikkinchi qorovul
          // arzon va u yerdagi tuzoq qimmat edi (izohi o'sha funksiyada).
          teacherName: showTeacher ? teacherName : "",
          studentName: showStudent ? studentName : "",
          // FAQAT SMS uchun: to'lov haqidagi xabar aynan shu o'quvchining
          // telefoniga ketsin. Jurnal yozuvi bugungidek ISM bilan
          // ishlaydi — bu maydon unga tegmaydi.
          //
          // Ism bo'yicha qidirish YARAMAYDI: bazada 511 ta ism
          // takrorlanadi va ularning 501 tasida telefon HAR XIL, ya'ni
          // har to'rtinchi to'lovda xabar begona odamga ketishi mumkin
          // edi (ichida to'lov summasi bor).
          studentId: showStudent ? selectedStudent?.id : undefined,
          // Qatorlar rejimida oy HAR QATORDA — bitta umumiy `periodMonth`
          // ma'nosiz bo'lardi, ustiga u orqaga sanalgan oylik hisobini
          // (payrollSources → carryOver) bekorga uyg'otishi mumkin edi.
          ...(showRows ? {} : { periodMonth }),
          date: date ? toIso(date) : undefined,
          note: finalNote,
        }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      invalidateBalances();      // ...va o'quvchi balansi ham o'zgardi
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSuccess({ cashbox: data.cashbox as Cashbox, entryId: typeof data.entryId === "number" ? data.entryId : undefined });
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return {
    t,
    months,
    paymentMethods,
    methodsLoading,
    showError,
    teachers,
    teacherNames,
    teachersLoading,
    categoryId,
    setCategoryId,
    teacherName,
    setTeacherName,
    studentKey,
    setStudentKey,
    amount,
    setAmount,
    balances,
    setBalances,
    method,
    setMethod,
    date,
    setDate,
    periodMonth,
    setPeriodMonth,
    periodTouched,
    setPeriodTouched,
    rows,
    setRows,
    nextRowId,
    setNextRowId,
    note,
    setNote,
    noteOptions,
    setNoteOptions,
    saving,
    setSaving,
    categories,
    setCategories,
    categoriesLoading,
    setCategoriesLoading,
    key,
    studentById,
    studentOptions,
    nameOf,
    phoneOf,
    teacherByName,
    teacherPhoneOf,
    balanceOf,
    selectedStudent,
    selectedBalance,
    studentName,
    pendingDisc,
    setPendingDisc,
    discPupilId,
    discKey,
    selectedType,
    category,
    audience,
    showTeacher,
    showStudent,
    showRows,
    total,
    noteMonthNums,
    noteMismatch,
    noteTarget,
    monthName,
    pickType,
    addRow,
    removeRow,
    updateRow,
    save,
  };
}

export type KirimFormState = ReturnType<typeof useKirimForm>;
