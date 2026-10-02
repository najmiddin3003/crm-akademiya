"use client";

import { loadBalancesByIdCached } from "@/lib/balancesClient";
import { invalidateBalances } from "@/lib/cacheKeys";
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import DatePicker from "@/components/ui/DatePicker";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import SuggestInput from "@/components/ui/SuggestInput";
import { useTeachers } from "@/hooks/useTeachers";
import type { StudentRow } from "@/lib/studentsData";
import type { TransactionType } from "@/lib/transactionTypes";
import { txAudience } from "@/lib/txTarget";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";
import { monthsInNote, nearestMonthKey } from "@/lib/noteMonth";

function fmtSom(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " so'm";
}

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
export default function CashboxKirimDrawer({
  cashbox,
  students,
  studentsLoading,
  studentsRefreshing,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  /**
   * O'quvchilar ro'yxati OTA SAHIFADAN keladi (CashboxesPage) — bu oyna
   * uni O'ZI SO'RAMAYDI.
   *
   * NEGA: ota sahifa aynan shu ro'yxatni allaqachon olgan va React
   * holatida ushlab turibdi. Ilgari drawer uni qaytadan so'rardi; kesh
   * kaliti bir xil ("pupils:light"), lekin TTL 30 s — ya'ni kassir
   * jurnalni ko'rib turib "+ Kirim" bosgan har safar 546 KB qaytadan
   * kelardi va `StudentSearchSelect` `disabled={loading}` bilan ~1.4 s
   * o'chib turardi. Endi so'rov umuman ketmaydi.
   */
  students: StudentRow[];
  studentsLoading: boolean;
  /** Ro'yxat FONDA yangilanmoqda — maydon ishlaydi, faqat izoh chiqadi. */
  studentsRefreshing: boolean;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  const { t, months } = useT();
  const modal = useModalClose(onClose, "drawer");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
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
  const [teacherName, setTeacherName] = useState("");
  // TANLANGAN O'QUVCHI — ID (satr ko'rinishida), ISM EMAS.
  //
  // NIMA NOTO'G'RI EDI: bu yerda ism turardi va ro'yxat ham ismlardan
  // tuzilardi. Bazada 545 ta ism takrorlanadi — ismdosh ikki bola
  // ro'yxatda BITTA qator bo'lib ko'rinardi, tanlanganda esa xaritadan
  // har doim BIRINCHISI olinardi. Ya'ni kassir ikkinchi bolaga to'lov
  // yozsa ham pul birinchisining hisobiga tushardi — foydalanuvchi aynan
  // shundan shikoyat qildi (23.09.2026, lib/pupilEntries.ts).
  const [studentKey, setStudentKey] = useState("");
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
  // Izoh va oy farqi haqidagi ogohlantirishni kassir ko'rib, baribir saqlamoqchi
  // bo'lgan holat — `${note}|${periodMonth}` kaliti (biri o'zgarsa yana so'raladi).
  const [mismatchAck, setMismatchAck] = useState("");
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
        if (kirim.length > 0) setCategoryId((cur) => cur ?? kirim[0].id);
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
    // Izohda boshqa oy yozilgan — birinchi bosishda to'xtab ko'rsatiladi,
    // ikkinchi bosishda (kassir ataylab shunday qoldirgan) saqlanadi.
    const ackKey = `${note}|${periodMonth}`;
    if (noteMismatch && mismatchAck !== ackKey) {
      setMismatchAck(ackKey);
      showError(t("Izohdagi oy «Qaysi oy uchun» maydonidagi oydan farq qiladi. Oyni to'g'rilang yoki yana «Saqlash»ni bosing."));
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
      onSaved(data.cashbox as Cashbox);
      showSuccess(t("Kirim qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Kirim")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Tranzaksiya")}</label>
            <div className="relative">
              {/* Ikkala yo'l ham `pickType()` dan o'tadi — u yagona
                  darvoza (izohi funksiyaning o'zida). */}
              <Select value={String(categoryId ?? "")} onChange={(v) => {
                  const id = Number(v);
                  pickType(categories.find((tv) => tv.id === id) ?? null);
                }} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={selectPlaceholder(categoriesLoading, categories.length, "Kirim turi qo’shilmagan")} clearable disabled={categoriesLoading} />
              {categoryId !== null && (
                <button
                  type="button"
                  onClick={() => pickType(null)}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={t("Tozalash")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          {/* O'QITUVCHI va O'QUVCHI tanlovlari turning "Mijoz"
              katakchalariga qarab chiqadi (Sozlamalar → Moliya →
              Tranzaksiya turi). Hech biri belgilanmagan bo'lsa ikkalasi
              ham chiqmaydi — masalan "Kitob sotuvi" da pul odamga
              bog'liq emas va uning o'rniga (Qiymat + Oy) qatorlari
              turadi. */}
          {showTeacher && (
          <div>
            {/* O'quvchi tanlovi bilan bir xil qidiruvli ro'yxat. Ilgari bu
                oddiy <select> edi: bazada 43 o'qituvchi bor va kerakligini
                topish uchun butun ro'yxatni aylantirishga to'g'ri kelardi,
                telefon raqami esa umuman ko'rinmasdi. */}
            <StudentSearchSelect
              label={t("O'qituvchini tanlang")}
              value={teacherName}
              onChange={setTeacherName}
              options={teacherNames}
              loading={teachersLoading}
              placeholder={t("Ism yoki telefon bo'yicha qidiring…")}
              subtitleOf={(n) => teacherPhoneOf(n)}
            />
          </div>
          )}

          {showStudent && (
          <div>
            <StudentSearchSelect
              label={t("O'quvchini tanlang")}
              value={studentKey}
              onChange={setStudentKey}
              options={studentOptions}
              labelOf={nameOf}
              loading={studentsLoading}
              placeholder={t("Ism yoki telefon bo'yicha qidiring…")}
              subtitleOf={(n) => phoneOf(n)}
              trailingOf={(n) => {
                const b = balanceOf(n);
                return <span className={b < 0 ? "text-rose-600" : "text-muted-foreground"}>{t(fmtSom(b))}</span>;
              }}
            />
            {/* Ro'yxat fonda yangilanayotgan payt. Sababi ko'rinib tursin:
                `StudentSearchSelect` erkin matn qabul qilmaydi (qiymat faqat
                ro'yxatdagi tugmadan chiqadi), ya'ni qabulxona hozirgina
                qo'shgan o'quvchini topa olmagan kassir nima kutayotganini
                bilmasdi. */}
            {studentsRefreshing && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("Ro'yxat yangilanmoqda…")}</p>
            )}
            {/* Tanlangandan keyin — balans va telefon. */}
            {selectedStudent && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-[12px]">
                <div>
                  Balans:{" "}
                  <strong className={selectedBalance < 0 ? "text-rose-600" : "text-emerald-600"}>{t(fmtSom(selectedBalance))}</strong>
                  {selectedStudent.phone && <span className="text-muted-foreground"> · +998 {selectedStudent.phone}</span>}
                </div>
                <Link
                  href={`/student-edit/${selectedStudent.id}?src=list`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  {t("O'quvchi profilini ko'rish")}
                </Link>
              </div>
            )}
            {/* Tanga evaziga chegirma — shu oy to'loviga (yuqoridagi izoh). */}
            {selectedStudent && !showRows && pendingDisc && pendingDisc.key === discKey && (() => {
              const d = pendingDisc;
              const teacherSet = showTeacher && teacherName.trim() !== "";
              const mismatch = teacherSet && d.teacherName.trim() !== "" && key(teacherName) !== key(d.teacherName);
              return (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed">
                  <div>
                    🏷️ <strong>{t("Tanga evaziga chegirma: −{sum} ({pct}%)", { sum: t(fmtSom(d.amountSom)), pct: d.percent })}</strong> — {d.groupLabel}
                  </div>
                  {!d.inGroup ? (
                    <div className="text-muted-foreground">{t("O'quvchi o'sha guruhda emas — chegirma qo'llanmaydi.")}</div>
                  ) : mismatch ? (
                    <div>
                      {t("Chegirma faqat {teacher} to'loviga qo'llanadi.", { teacher: d.teacherName })}{" "}
                      <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setTeacherName(d.teacherName)}>
                        {t("Shu o'qituvchini tanlash")}
                      </button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">{t("O'quvchidan shuncha kam oling — saqlanganda chegirma o'zi qo'llanadi.")}</div>
                  )}
                </div>
              );
            })()}
          </div>
          )}

          {/* ODATDAGI turlar — bitta Qiymat maydoni (bugungidek). */}
          {!showRows && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {/* UCHINCHI SHAXS — (Qiymat + Oy) juftlari. Bitta sotuv bir
              necha oyni qoplashi mumkin, shuning uchun qator qo'shiladi.
              Qatorlar KALKULYATOR: ular alohida jurnal yozuvi yaratmaydi,
              yig'indi bitta yozuvga ketadi (sabab `save()` izohida). */}
          {showRows && (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={row.id} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
                    <MoneyInput
                      value={row.amount}
                      onChange={(v) => updateRow(row.id, { amount: v })}
                      placeholder={t("Qiymat")}
                      className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[13px] font-medium mb-1.5">{t("Oyni tanlang")}</label>
                    <MonthYearPicker
                      className="w-full"
                      value={{
                        month: Number(row.periodMonth.slice(5, 7)),
                        year: Number(row.periodMonth.slice(0, 4)),
                      }}
                      onChange={(v) =>
                        updateRow(row.id, {
                          periodMonth: `${v.year}-${String(v.month).padStart(2, "0")}`,
                        })
                      }
                    />
                  </div>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="h-10 w-10 shrink-0 rounded-lg border border-border text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                      title={t("O'chirish")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="h-9 w-9 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center justify-center"
                title={t("Qator qo'shish")}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Yig'indi FAQAT bir nechta qator bo'lganda — bitta qatorda u
              yuqoridagi "Qiymat" ning takrori bo'lardi. Shart `showRows`
              ga EMAS: yuboriladigan summa ekranda ko'rinib turishi kerak. */}
          {rows.length > 1 && showRows && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Umumiy summa")}</label>
              <input
                value={groupNumber(total)}
                readOnly
                type="text"
                className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
              />
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            <Select value={method} onChange={(v) => setMethod(v)} options={paymentMethods.map((m) => ({ value: m.key, label: m.name }))} placeholder={selectPlaceholder(methodsLoading, paymentMethods.length, "To’lov turi qo’shilmagan")} clearable disabled={methodsLoading} />
          </div>

          {/* Uchinchi shaxs turida oy QATORLARDA tanlanadi, shu bois bu
              yerda faqat sana qoladi va grid bitta ustunga tushadi. */}
          <div className={showRows ? "" : "grid grid-cols-2 gap-3"}>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Sanani tanlang")}</label>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  // Sana o'zgarsa oy ham ergashadi — kassir odatda bugungi
                  // kun uchun to'lov qabul qiladi va ikkinchi maydonga
                  // umuman tegishi shart emas. Oy QO'LDA tanlangan bo'lsa
                  // — tegilmaydi (`periodTouched` izohi).
                  if (d && !periodTouched) setPeriodMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="w-full"
              />
            </div>
            {!showRows && (
              <div>
                <label className="block text-[13px] font-medium mb-1.5">{t("Qaysi oy uchun")}</label>
                <MonthYearPicker
                  className="w-full"
                  value={{ month: Number(periodMonth.slice(5, 7)), year: Number(periodMonth.slice(0, 4)) }}
                  onChange={(v) => {
                    setPeriodMonth(`${v.year}-${String(v.month).padStart(2, "0")}`);
                    setPeriodTouched(true);
                  }}
                />
              </div>
            )}
          </div>
          {/* To'lov sanasi va u qoplaydigan oy HAR DOIM bir xil emas:
              sentabrda kelgan pul avgust darslari uchun bo'lishi mumkin.
              O'qituvchining foizli oyligi aynan shu oyga hisoblanadi.
              Shart `showTeacher` ni ham tekshiradi: o'qituvchi tanlovi
              chiqmaydigan turda bu ogohlantirish YOLG'ON bo'lardi — u
              yerda hech kimning oyligi o'zgarmaydi. */}
          {noteMismatch ? (
            <div className="-mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700">
              {t("Izohda {note} yozilgan, lekin to'lov {month} oyiga yoziladi.", {
                note: noteMonthNums.map((m) => months[m - 1]).join(", "),
                month: monthName(periodMonth),
              })}
              {noteTarget && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMonth(noteTarget);
                    setPeriodTouched(true);
                  }}
                  className="ml-1 font-semibold text-primary hover:underline"
                >
                  {t("{month} oyiga o'tkazish", { month: monthName(noteTarget) })}
                </button>
              )}
            </div>
          ) : !showRows && showTeacher && periodMonth !== (date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "") && (
            <p className="-mt-1 text-[11px] text-amber-600">
              {t("To'lov {month} oyiga yoziladi — o'qituvchining o'sha oydagi oyligiga qo'shiladi.", { month: monthName(periodMonth) })}
            </p>
          )}

          {/* IZOH — oddiy input, lekin ustiga bosilganda shu kassada ilgari
              yozilgan izohlar chiqadi va yozgan sari filtrlanadi. Ro'yxat
              MAJBURLAMAYDI: yangi matn ham bemalol yoziladi. */}
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <SuggestInput
              value={note}
              onChange={setNote}
              options={noteOptions}
              placeholder={t("Yozing yoki avvalgilaridan tanlang")}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
