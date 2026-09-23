"use client";

import { loadBalancesByIdCached } from "@/lib/balancesClient";
import { invalidateBalances } from "@/lib/cacheKeys";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import DatePicker from "@/components/ui/DatePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import StudentGroupsModal from "./StudentGroupsModal";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import type { StudentRow } from "@/lib/studentsData";
import type { TransactionType } from "@/lib/transactionTypes";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useTeachers } from "@/hooks/useTeachers";
import { type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import { txTarget, txTargetLabel } from "@/lib/txTarget";
import {
  payrollCashLeg,
  payrollEarned,
  payrollPaid,
  payrollPayout,
  payrollPeriod,
  payrollPeriodOf,
  payrollPlastikLeg,
  payrollTax,
  type EmployeePayroll,
} from "@/lib/salary";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import { ROLE_LABELS } from "@/constants/employees";
import { invalidateTransactions } from "@/lib/cacheKeys";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function fmtSum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Row {
  id: number;
  amount: string;
}

// Kassalar sahifasidagi "- Chiqim" — referens saytdagi oyna: Tranzaksiya
// (xarajat turi), O'quvchini/Xodimni tanlang, so'ng bir nechta Qiymat
// qatori — "+" bosilsa yana bir qator qo'shiladi (bitta xarajatni bir
// nechta band qilib yozish uchun), ularning yig'indisi "Umumiy summa"da
// avtomatik ko'rsatiladi. Pul harakati (methodTotals/balance) shu umumiy
// summa bo'yicha /api/cashboxes/:id/adjust orqali HAQIQIY, kategoriya/
// o'quvchi/sana/izoh bilan birga — "Tranzaksiyalar" va "Moliya hisobotlari/
// analitikasi" ko'radigan haqiqiy jurnalga yoziladi. "Tranzaksiya" ro'yxati
// — Moliya → Tranzaksiya turi (/finance-tx-types) sahifasidagi HAQIQIY,
// admin boshqaradigan ro'yxatdan (mainType: "chiqim").
//
// OLIB TASHLANGAN: har bir qatorda "Oyni tanlang" degan, hatto yulduzcha
// bilan MAJBURIY deb belgilangan tanlagich turardi. Tanlangan oy hech
// qachon hech qayerga yuborilmasdi — /api/cashboxes/:id/adjust so'rov
// tanasida bunday maydon yo'q, `transaction_entries` yozuvida ham xarajat
// qaysi OYGA tegishli ekanini saqlaydigan maydon yo'q. Ya'ni foydalanuvchi
// "iyul oyiga" deb belgilab saqlardi, natijada esa hech qanday farq
// bo'lmasdi. Qayta tiklash uchun avval jurnal yozuviga davr maydoni
// (masalan `periodMonth`) qo'shilishi kerak.
export default function CashboxAdjustDrawer({
  cashbox,
  students,
  studentsLoading,
  studentsRefreshing,
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  mode: "chiqim";
  /**
   * O'quvchilar ro'yxati OTA SAHIFADAN (CashboxesPage) keladi — bu oyna
   * uni O'ZI SO'RAMAYDI. Sabab CashboxKirimDrawer dagi bilan bir xil:
   * ota sahifa ro'yxatni allaqachon olgan, drawer esa uni bir xil kesh
   * kaliti bilan qaytadan so'rardi va TTL (30 s) o'tgach 546 KB / ~1.4 s
   * kutardi — o'sha paytda tanlov maydoni `disabled` bo'lib turardi.
   */
  students: StudentRow[];
  studentsLoading: boolean;
  /** Ro'yxat FONDA yangilanmoqda — maydon ishlaydi, faqat izoh chiqadi. */
  studentsRefreshing: boolean;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  // Tanlangan tur ID bo'yicha saqlanadi, nom bo'yicha emas: turning "Mijoz"
  // maydoni ham kerak, nom esa noyob emas (POST /api/transaction-types nom
  // takrorlanishini tekshirmaydi va bazada `name` bo'yicha unikal indeks
  // yo'q). Serverga baribir NOM ketadi — jurnal, analitika va hisobotlar
  // shu nom bo'yicha guruhlanadi.
  const [categoryId, setCategoryId] = useState<number | null>(null);
  // Tanlangan KIM — tranzaksiya turiga qarab o'quvchi yoki xodim.
  // TANLANGAN ODAM — bitta maydon, ikki ma'no:
  //   xodim turida   → xodimning ISMI (xodimlar ro'yxati ism bilan
  //                    ishlaydi, ular takrorlanmaydi);
  //   o'quvchi turida→ o'quvchining ID'si (satr).
  //
  // NEGA O'QUVCHIDA ID: bazada 545 ta ism takrorlanadi va ro'yxatda
  // ismdosh ikki bola bitta qator bo'lib ko'rinardi — kassir qaysi
  // biridan pul qaytarayotganini bilmasdi, xaritadan esa doim
  // BIRINCHISI olinardi (lib/pupilEntries.ts).
  const [personKey, setPersonKey] = useState("");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  // O'quvchilar balansi (haqiqiy to'lovlar yig'indisi) — Kirim oynasidagi
  // bilan bir xil manba (/api/students/balances).
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [rows, setRows] = useState<Row[]>([{ id: 1, amount: "" }]);
  const [nextRowId, setNextRowId] = useState(2);
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // Turlar TO'LIQ saqlanadi. Ilgari bu yerda `.map((tv) => tv.name)` turardi
  // va turning "Mijoz" maydoni aynan shu qatorda yo'qolardi — javobda u bor
  // edi, lekin brauzergacha yetib kelmasdi.
  const [categories, setCategories] = useState<TransactionType[]>([]);
  // Bayroq `true` bo'lganda tanlovda BO'SH-HOLAT xabari ("Chiqim turi
  // qo'shilmagan", "Topilmadi") ko'rsatilmaydi — o'sha onda u yolg'on
  // bo'lardi. Boshlang'ich qiymat `true`: ochilish zahoti fetch ketadi.
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // Xodimlar ro'yxati SHARTLI yuklanadi (faqat "xodimga to'lov" turida),
  // shuning uchun bayroq HOSILA: effekt tanasida setState chaqirilsa
  // kaskad render bo'lardi (react-hooks/set-state-in-effect).
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const selectedType = useMemo(
    () => categories.find((tv) => tv.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const category = selectedType?.name ?? "";
  // Xodimlarning HAQIQIY oylik qatorlari — ism bo'yicha kalitlangan.
  const [payroll, setPayroll] = useState<Map<string, EmployeePayroll>>(new Map());
  // Tanlangan SANANING oyi — oylik qatori (hisoblangan ham, "shu oyda
  // allaqachon berilgan" ham) AYNAN shu oy uchun so'raladi.
  //
  // Ilgari `period` doim JORIY oy edi va "olingan" alohida so'rov bilan
  // tanlangan sana oyidan olinardi. Kassir sanani o'tgan oyga qo'yganda
  // "hisoblangan oylik" sentabrniki, "olingan" esa avgustniki bo'lib
  // chiqardi — chegara ikki xil oydan yig'ilardi va o'tgan oy uchun avans
  // berishga to'sqinlik qilardi. Endi hammasi bitta qatordan.
  const monthKey = useMemo(() => {
    if (!date) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}`;
  }, [date]);
  const period = useMemo(() => (monthKey ? payrollPeriodOf(monthKey) : payrollPeriod()), [monthKey]);

  // Maosh/guruh modali ochiq bo'lsa Escape faqat o'shani yopsin — aks holda
  // ikkala tinglovchi ham ishga tushib, chekma ham yopilib ketardi.

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setCategories((d.types as TransactionType[]).filter((tv) => tv.mainType === "chiqim"));
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Xodimlar ro'yxati faqat kerak bo'lganda (xodimga oylik/avans) yuklanadi.
  const target = txTarget(selectedType);
  // "Xodim" turiga o'tilgan, lekin ro'yxat hali kelmagan payt — aynan shu
  // oraliqda tanlov bo'sh turadi. Hosila bayroq: effekt tanasida
  // `setState` chaqirilmaydi.
  const employeesLoading = target === "employee" && !employeesLoaded && employees.length === 0;
  useEffect(() => {
    if (target !== "employee" || employees.length > 0) return;
    let cancelled = false;
    // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
    // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
    fetch("/api/hr-employees/ref")
      .then((r) => r.json())
      .catch(() => null)
      .then((emps) => {
        if (cancelled || !emps?.ok) return;
        setEmployees(emps.employees as HrEmployee[]);
      })
      .finally(() => { if (!cancelled) setEmployeesLoaded(true); });
    return () => { cancelled = true; };
  }, [target, employees.length]);

  // Oylik qatorlari ALOHIDA yuklanadi va SANA o'zgarsa qayta so'raladi:
  // xodimlar ro'yxati oydan qat'i nazar bir xil, hisoblangan oylik esa
  // oyga bog'liq. Ilgari ikkalasi bitta so'rovda edi va faqat bir marta
  // yuklanardi — sana o'tgan oyga surilganda ekranda joriy oyning
  // raqamlari qolib ketardi.
  useEffect(() => {
    if (target !== "employee" || !monthKey) return;
    let cancelled = false;
    // `branch=all` — xodimlar ro'yxati (/api/hr-employees/ref) filialga
    // KESILMAGAN, oylik qatorlari ham shunday kelishi kerak. Aks holda
    // boshqa filialdagi xodim "Sozlanmagan" bo'lib ko'rinadi va oynadagi
    // chegara jimgina o'chib qoladi, server esa chegarani baribir global
    // qo'llaydi — oyna bilan server bir-biriga zid javob berardi.
    fetch(`/api/salary-runs/employees-payroll?month=${monthKey}&branch=all`)
      .then((r) => r.json())
      .catch(() => null)
      .then((pay) => {
        if (cancelled || !pay?.ok) return;
        setPayroll(new Map((pay.employees as EmployeePayroll[]).map((e) => [e.name.trim().toLowerCase(), e])));
      });
    return () => { cancelled = true; };
  }, [target, monthKey]);

  // Arxivdagi xodimga oylik berilmaydi — ro'yxatda faqat aktivlar.
  const activeEmployees = employees.filter((e) => !e.archReason);
  const roleOf = (name: string) => activeEmployees.find((e) => e.name === name)?.turi ?? "";
  const selectedEmployee = target === "employee" ? activeEmployees.find((e) => e.name === personKey) : undefined;

  // O'quvchi balansi — faqat "o'quvchiga pul qaytarildi" turidagi
  // chiqimlarda kerak (target === "student"da har doim shu ma'no).
  const studentById = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const s of students) map.set(String(s.id), s);
    return map;
  }, [students]);
  const studentOptions = useMemo(() => students.map((s) => String(s.id)), [students]);
  const studentNameOf = (k: string) => studentById.get(k)?.name ?? "";
  const balanceOf = (k: string) => balances[Number(k)] ?? 0;
  const selectedStudent = target === "student" ? studentById.get(personKey) : undefined;
  const studentBalance = selectedStudent ? balanceOf(personKey) : 0;
  // Serverga va jurnalga ISM ketadi (xodim ham, o'quvchi ham "KIM"
  // ustunida ko'rinadi); o'quvchida bog'lanish ID bo'yicha ketadi.
  const personName = target === "student" ? selectedStudent?.name ?? "" : personKey;

  useEffect(() => {
    if (target !== "student") return;
    let cancelled = false;
    loadBalancesByIdCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [target]);

  // O'QUVCHIGA PUL QAYTARISH — QAYSI USTOZDAN (foydalanuvchi, 18.09.2026).
  //
  // Qaytarilgan summa o'quvchi balansidan ayriladi va USTOZNING shu oydagi
  // tushumidan ham ayriladi — foizli oyligi qaytarilgan summaning foizi
  // qadar kamayadi (50% bo'lsa yarmi ustozdan, yarmi markaz hisobidan).
  // Ustoz o'quvchining ENG OXIRGI to'lovidagi `teacherName` dan o'zi
  // to'ldiriladi (o'sha to'lovga foiz hisoblangan edi), kassir o'zgartira
  // oladi — o'quvchi ikki ustozda o'qisa qaysi to'lov qaytarilayotganini
  // faqat u biladi. Bo'sh qoldirilsa server o'zi topadi (oxirgi to'lov →
  // guruh ustozi, lib/studentRefund.ts); u ham topolmasa yozuv ustozsiz
  // qoladi va faqat balansga ta'sir qiladi.
  const { names: teacherNames, loading: teachersLoading } = useTeachers();
  // O'quvchi yoki tur almashganda o'sha tanlovlarning onChange'i buni
  // tozalaydi — effekt ichida sinxron setState yo'q
  // (react-hooks/set-state-in-effect).
  const [refundTeacher, setRefundTeacher] = useState("");
  // O'quvchining oxirgi to'lovi ID bo'yicha so'raladi: ism bo'yicha
  // so'rovda ismdoshning to'lovi kelib, qaytarim BEGONA ustozning
  // tushumidan ayrilib ketardi (lib/pupilEntries.ts).
  const refundPupilId = target === "student" ? selectedStudent?.id ?? null : null;
  useEffect(() => {
    if (refundPupilId === null) return;
    let cancelled = false;
    fetch(`/api/transaction-entries?pupilId=${refundPupilId}&txType=payIn&excludeCancelled=1&limit=1&slim=1`)
      .then((r) => r.json())
      .catch(() => null)
      .then((d) => {
        if (cancelled || !d?.ok) return;
        const last = (d.entries as TransactionEntry[])[0];
        // Foydalanuvchi shu orada o'zi tanlagan bo'lsa — uniki qoladi.
        setRefundTeacher((cur) => cur || String(last?.teacherName ?? "").trim());
      });
    return () => { cancelled = true; };
  }, [refundPupilId]);

  // Qatorlar yig'indisi. "Oylik" turida summa qatorlardan EMAS, xodimning
  // hisoblangan qoldig'idan olinadi — pastdagi `total` ga qarang.
  const rowsTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const available = method ? cashbox.methodTotals[method as keyof CashboxMethodTotals] ?? 0 : null;

  // To'lov turlari ro'yxati alohida hisoblanadi: birinchi `<option>` matni
  // uchun HAQIQATAN chiziladigan variantlar SONI kerak (ro'yxat kassada
  // mablag'i bor turlar bilan cheklangan).
  const methodOptions = useMemo(
    () =>
      paymentMethods
        .map((m) => ({ m, bal: cashbox.methodTotals[m.key as keyof CashboxMethodTotals] ?? 0 }))
        .filter(({ bal }) => bal > 0),
    [paymentMethods, cashbox.methodTotals],
  );

  // "Hodimga oylik" va "Hodimga avans" turlarida umumiy summa xodimning shu
  // oyda qolgan oyligidan oshmasligi kerak (referens qoida: avans oylikdan
  // ayrilib beriladi, tugasa keyingi oygacha yana chiqarilmaydi). Nomlar
  // admin boshqaradigan ro'yxatdan olinadi, shuning uchun so'zga qaraymiz.
  const isSalaryPayoutCategory = target === "employee" && /avans|oylik/i.test(category);

  // Xodimning HAQIQIY oylik qatori (/api/salary-runs/employees-payroll).
  // Ilgari bu yerda xodim id'sidan hisoblanadigan demo funksiya turardi va
  // o'ylab topilgan raqam haqiqiy pulning chiqishini boshqarardi.
  const payrollOf = (name: string) => payroll.get(name.trim().toLowerCase());
  const selectedPayroll = selectedEmployee ? payrollOf(selectedEmployee.name) : undefined;
  const salaryConfigured = !!selectedPayroll?.configured;
  // Hisoblangan oylik = asos + bonus - jarima (lib/salary.ts).
  const employeeOylik = selectedPayroll && selectedPayroll.configured
    ? payrollEarned(selectedPayroll, period)
    : 0;

  // CHIQARISH CHEGARASI — Oylik hisob-kitob sahifasi bilan AYNAN BIR XIL
  // funksiyalar (lib/salary.ts), ya'ni oyna, sahifa va server bitta
  // raqamni ko'radi:
  //
  //   naqd (va boshqa) turida → payrollCashLeg — hisoblangan − soliq −
  //                              KARTA − olingan (+ o'tgan oydan);
  //   plastik turida          → payrollPayout  — karta oyog'i + naqd qoldig'i.
  //
  // QOIDA (foydalanuvchi, 16.09.2026): karta qoplanmaguncha naqd avans ham,
  // oylik ham chiqmaydi — xodim ishlab topgani avval kartaga ketadi, qo'lga
  // faqat undan oshgani. Shu bois naqd chegara "hisoblangan − olingan" EMAS.
  //
  // "Olingan" ham qatorning o'zidan (`paidAvans + paidOylik`): ilgari u
  // alohida /api/employee-salary-summary so'rovi bilan olinardi va o'sha
  // so'rov faqat `date` oyiga qarardi — o'tgan oy uchun deb belgilangan
  // to'lov (`periodMonth`) ikki manbada ikki xil oyga tushib, chegara
  // sahifadagi raqamdan farq qilardi.
  const isPlastikMethod = method === PLASTIK_METHOD_KEY;
  const salaryBreakdown = selectedPayroll && selectedPayroll.configured
    ? {
        tax: payrollTax(selectedPayroll, period),
        karta: payrollPlastikLeg(selectedPayroll, period),
        paid: payrollPaid(selectedPayroll),
        carryOver: selectedPayroll.carryOver,
        naqd: payrollCashLeg(selectedPayroll, period),
        jami: payrollPayout(selectedPayroll, period),
      }
    : null;
  const remainingSalary = salaryBreakdown ? (isPlastikMethod ? salaryBreakdown.jami : salaryBreakdown.naqd) : 0;
  // Karta hali to'liq qoplanmagan (qoldiq mo'ljaldan kichik) — naqd 0
  // bo'lishining sababi shu; xabarda "oylik tugagan" EMAS, shu aytiladi.
  const kartaYetmadi = !!salaryBreakdown && !isPlastikMethod && salaryBreakdown.naqd <= 0
    && selectedPayroll!.plastikSalary > 0 && salaryBreakdown.jami > 0;
  // "OYLIK" TURIDA SUMMA QO'LDA TERILMAYDI (foydalanuvchi, 18.09.2026):
  // Qiymat maydonida xodimning shu oyda CHIQARISH MUMKIN bo'lgan qoldig'i
  // (yuqoridagi `remainingSalary` — hisoblangan − soliq − karta − olingan,
  // tanlangan to'lov turiga qarab) o'zi turadi va faqat o'qiladi. Sabab:
  // oylik — qoldiqning to'liq o'zi; qo'lda terilsa kassir xato raqam
  // kiritishi yoki bir qismini qoldirib ketishi mumkin edi. Qisman berish
  // "Avans" turining ishi — u yerda maydon avvalgidek erkin.
  //
  // FAQAT oyligi sozlangan xodimda: sozlanmaganda qoldiq ma'nosiz (0) va
  // chegara ham qo'llanmaydi — maydon erkin qoladi. To'lov turi
  // almashtirilsa (naqd ↔ plastik) summa o'zi qayta hisoblanadi.
  const oylikLocked = target === "employee" && /oylik/i.test(category) && !!selectedEmployee && salaryConfigured;
  const total = oylikLocked ? remainingSalary : rowsTotal;
  // Oyligi sozlanmagan xodimga chegara qo'llanmaydi (server ham shunday) —
  // aks holda 0 deb o'qilib, hamma to'lov rad etilgan bo'lardi.
  const salaryExhausted = isSalaryPayoutCategory && !!selectedEmployee && salaryConfigured && remainingSalary <= 0;
  const salaryExceeds = isSalaryPayoutCategory && !!selectedEmployee && salaryConfigured && total > remainingSalary;
  const exhaustedMessage = kartaYetmadi
    ? t("Hisoblangan oylik karta summasidan oshmaydi — naqd avans yoki oylik chiqarib bo'lmaydi (qoldiq {karta} kartaga ketadi)", { karta: fmtUZS(salaryBreakdown!.karta) })
    : "Bu oyda xodimga chiqariladigan qoldiq yo'q — oylik to'liq chiqarilgan yoki hali hisoblanmagan";

  // O'quvchiga qaytariladigan summa uning balansidan oshmasligi kerak.
  const studentBalanceExceeds = target === "student" && !!selectedStudent && total > studentBalance;

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId, amount: "" }]);
    setNextRowId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!category) {
      showError(t("Tranzaksiya turini tanlang"));
      return;
    }
    // Tanlov maydoni ko'rinib turgan bo'lsa, u BO'SH qolmasin. Aks holda
    // yozuv egasiz tug'iladi: xodimga berilgan avans hech kimning oylik
    // hisobiga tushmaydi va oddiy xarajat bo'lib qoladi (jurnalda aynan
    // shunday bitta yozuv bor — "Avans", −20 000, xodimsiz).
    if (target !== null && !personKey.trim()) {
      showError(txTargetLabel(target));
      return;
    }
    if (!total || total <= 0) {
      showError(t("Qiymatni to'g'ri kiriting"));
      return;
    }
    if (!method) {
      showError(t("To'lov turini tanlang"));
      return;
    }
    if (available != null && total > available) {
      showError(t("Mablag' yetarli emas"));
      return;
    }
    if (salaryExhausted) {
      showError(exhaustedMessage);
      return;
    }
    if (salaryExceeds) {
      showError(`Summa ${isPlastikMethod ? "qolgan oylikdan" : "naqd chiqarish mumkin bo'lgan summadan"} (${fmtUZS(remainingSalary)}) ko'p bo'lishi mumkin emas`);
      return;
    }
    if (studentBalanceExceeds) {
      showError(t("Summa o'quvchi balansidan ({studentBalance}) ko'p bo'lishi mumkin emas", { studentBalance: fmtUZS(studentBalance) }));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cashboxes/${cashbox.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chiqim",
          method,
          amount: total,
          category,
          // Jurnaldagi "KIM" ustuni shu maydondan o'qiladi (o'quvchi ham,
          // xodim ham shu yerda ko'rsatiladi — referensda ham shunday).
          studentName: personName,
          // O'QUVCHIGA pul qaytarilganda yozuvga o'quvchining ID'si ham
          // tushadi (`pupilId`, lib/transactionEntries.ts) — ismdosh
          // o'quvchining balansidan ayrilib ketmasin. Xodimga chiqimda
          // yuborilmaydi: u yerda "KIM" — xodim.
          studentId: target === "student" ? selectedStudent?.id : undefined,
          // Yozuv KIMNING oyligiga tegishli. Xodimga chiqim bo'lsa — o'sha
          // xodim. Server buni nomdagi "avans|oylik" so'ziga qarab ham
          // topadi, lekin "KPI bonusi", "Bayram mukofoti" kabi turlarda bu
          // so'zlar yo'q va yozuv egasiz qolardi. O'quvchiga pul
          // qaytarishda — tushumidan ayriladigan ustoz (yuqoridagi
          // `refundTeacher`; bo'sh bo'lsa server o'zi topadi).
          teacherName: target === "employee" ? personName
            : target === "student" ? (refundTeacher || undefined)
            : undefined,
          date: date ? toIso(date) : undefined,
          note,
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
      showSuccess(t("Chiqim amalga oshirildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <><Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{t("Chiqim")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Tranzaksiya")}</label>
            <Select value={String(categoryId ?? "")} onChange={(v) => {
                  // Tur o'zgarsa avval tanlangan kishi kerak bo'lmay qolishi
                  // mumkin (o'quvchi → xodim yoki umuman tanlovsiz tur).
                  // Tozalanmasa, maydon yashirinib ketgan bo'lsa ham eski
                  // ism `studentName` bo'lib yozuvga tushardi.
                  const next = categories.find((tv) => tv.id === Number(v)) ?? null;
                  if (txTarget(next) !== target) {
                    setPersonKey("");
                    setRefundTeacher("");
                  }
                  setCategoryId(next?.id ?? null);
                }} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={selectPlaceholder(categoriesLoading, categories.length, "Chiqim turi qo'shilmagan")} clearable disabled={categoriesLoading} />
          </div>

          {/* Kim tanlanishi tranzaksiya turiga bog'liq (lib/txTarget.ts):
              xodimga oylik/avans → xodimlar, o'quvchiga pul qaytarildi →
              o'quvchilar, qolgan turlarda (List, Printer, Suv…) tanlov
              umuman ko'rsatilmaydi. */}
          {target !== null && (
            <div className="space-y-2">
              <StudentSearchSelect
                label={txTargetLabel(target)}
                value={personKey}
                onChange={(v) => {
                  setPersonKey(v);
                  // Boshqa o'quvchi — oldingisining ustozi qolib ketmasin;
                  // yangisi effektda oxirgi to'lovidan qayta to'ladi.
                  setRefundTeacher("");
                }}
                options={target === "employee" ? activeEmployees.map((e) => e.name) : studentOptions}
                // O'quvchi turida variantlar ID, ko'rinadigan matn esa ism.
                labelOf={target === "student" ? studentNameOf : undefined}
                // Bitta tanlovni IKKI manba to'ldiradi — turga QARAB: xodim
                // turida xodimlar ro'yxati, aks holda o'quvchilar. Ikkalasini
                // birlashtirib yuborish xato bo'lardi — o'quvchi
                // tanlanayotganda xodimlar ro'yxati kutilmasligi kerak.
                loading={target === "employee" ? employeesLoading : studentsLoading}
                placeholder={target === "employee" ? t("Xodimni qidiring…") : t("Tanlang")}
                subtitleOf={target === "employee" ? (n) => ROLE_LABELS[roleOf(n) as keyof typeof ROLE_LABELS] ?? roleOf(n) : undefined}
                // Ism yonida shu oynada CHIQARISH MUMKIN bo'lgan summa —
                // tanlangan to'lov turiga qarab (naqd: kartadan keyingi
                // qoldiq; plastik: karta + naqd), jami hisoblangan emas.
                // Pastdagi `remainingSalary` bilan bir xil qoida.
                trailingOf={target === "employee" ? (n) => {
                  const p = payrollOf(n);
                  if (!p?.configured) return <span className="text-muted-foreground">{t("Sozlanmagan")}</span>;
                  const can = isPlastikMethod ? payrollPayout(p, period) : payrollCashLeg(p, period);
                  return <span className={can > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(can)}</span>;
                } : target === "student" ? (n) => {
                  const b = balanceOf(n);
                  return <span className={b > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(b)}</span>;
                } : undefined}
              />

              {/* Ro'yxat fonda yangilanayotgan payt. Faqat o'quvchi turida:
                  xodimlar ro'yxati boshqa manbadan keladi. Sababi ko'rinib
                  tursin — `StudentSearchSelect` erkin matn qabul qilmaydi,
                  ya'ni hozirgina qo'shilgan o'quvchini topa olmagan kassir
                  nima kutayotganini bilmasdi. */}
              {target === "student" && studentsRefreshing && (
                <p className="text-[11px] text-muted-foreground">{t("Ro'yxat yangilanmoqda…")}</p>
              )}

              {selectedStudent && (
                <div className="space-y-2">
                  <div className="text-[13px] rounded-md border border-border bg-secondary/20 px-2.5 py-2">
                    Balans:{" "}
                    <strong className={studentBalance > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                      {fmtUZS(studentBalance)}
                    </strong>
                  </div>
                  {studentBalanceExceeds && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      Summa o&apos;quvchi balansidan ({fmtUZS(studentBalance)}) ko&apos;p bo&apos;lishi mumkin emas.
                    </div>
                  )}
                  {/* Qaytarilgan pul qaysi ustozning tushumidan ayrilishi —
                      o'quvchining oxirgi to'lovidagi ustoz o'zi tushadi
                      (yuqoridagi effekt), kassir o'zgartira oladi. */}
                  <StudentSearchSelect
                    label={t("Ustozi (tushumidan ayriladi)")}
                    value={refundTeacher}
                    onChange={setRefundTeacher}
                    options={teacherNames}
                    loading={teachersLoading}
                    placeholder={t("Ism bo'yicha qidiring…")}
                  />
                  <p className="text-[11.5px] text-muted-foreground leading-snug">
                    {t("Qaytarilgan summa o'quvchi balansidan va ustozning shu oydagi tushumidan ayriladi — ustozning foizli oyligi shu summaning foizi qadar kamayadi, qolgani markaz hisobidan ketadi.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setGroupsOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    {t("O'quvchi guruhlarini ko'rish")}
                  </button>
                </div>
              )}

              {selectedEmployee && (
                <>
                  {/* Xodim tanlangach — nimadan qancha chiqarish mumkinligi. */}
                  {isSalaryPayoutCategory ? (
                    salaryConfigured && salaryBreakdown ? (
                      // Hisob zanjiri OCHIQ yoziladi — kassir naqd nega
                      // kam (yoki 0) ekanini shu yerning o'zida ko'rsin:
                      // karta va soliq avval ayriladi. Plastik turida
                      // chegara karta + naqd, ya'ni karta qatori chiqmaydi.
                      <div className="text-[12.5px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2">
                        {isPlastikMethod ? t("Kartaga chiqarish mumkin: ") : t("Naqd chiqarish mumkin: ")}
                        <strong>{fmtUZS(remainingSalary)}</strong>
                        <span className="text-muted-foreground">
                          {" "}(Jami oylik {fmtUZS(employeeOylik)}
                          {salaryBreakdown.tax > 0 ? t(" − soliq {tax}", { tax: fmtUZS(salaryBreakdown.tax) }) : ""}
                          {salaryBreakdown.carryOver > 0 ? t(" + o'tgan oydan {carryOver}", { carryOver: fmtUZS(salaryBreakdown.carryOver) }) : ""}
                          {salaryBreakdown.carryOver < 0 ? t(" − o'tgan oy qarzdorligi {carryOver}", { carryOver: fmtUZS(-salaryBreakdown.carryOver) }) : ""}
                          {salaryBreakdown.paid > 0 ? t(" − olingan {paid}", { paid: fmtUZS(salaryBreakdown.paid) }) : ""}
                          {!isPlastikMethod && salaryBreakdown.karta > 0 ? t(" − kartaga {karta}", { karta: fmtUZS(salaryBreakdown.karta) }) : ""}
                          )
                        </span>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2">
                        {t("Ish haqi sozlanmagan — chegara qo'llanmaydi. Xodim profilida oylikni kiriting.")}
                      </div>
                    )
                  ) : (
                    <div className="text-[13px] text-muted-foreground">
                      {salaryConfigured ? `Oylik: ${fmtUZS(employeeOylik)}` : "Ish haqi sozlanmagan"}
                    </div>
                  )}
                  {isSalaryPayoutCategory && salaryExhausted && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      {exhaustedMessage}.
                    </div>
                  )}
                  {isSalaryPayoutCategory && !salaryExhausted && salaryExceeds && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      {`Summa ${isPlastikMethod ? "qolgan oylikdan" : "naqd chiqarish mumkin bo'lgan summadan"} (${fmtUZS(remainingSalary)}) ko'p bo'lishi mumkin emas.`}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSalaryOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    {t("Xodim ma'lumotlarini ko'rish")}
                  </button>
                </>
              )}
            </div>
          )}

          {oylikLocked ? (
            // "Oylik": bitta, faqat o'qiladigan maydon — summa xodimning
            // qoldig'idan (yuqoridagi `oylikLocked` izohi). Qator qo'shish
            // ham yo'q: oylik bir necha bandga bo'linmaydi.
            <div>
              <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
              <input
                value={groupNumber(remainingSalary)}
                readOnly
                type="text"
                className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
              />
              <div className="text-[12px] text-muted-foreground mt-1">
                {t("Oylik summasi hisobdan olinadi — qo'lda o'zgartirilmaydi.")}
              </div>
            </div>
          ) : (
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
                  <MoneyInput
                    value={row.amount}
                    onChange={(v) => updateRow(row.id, { amount: v })}
                    placeholder={t("Qiymat")}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
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

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Umumiy summa")}</label>
            <input
              value={groupNumber(total)}
              readOnly
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("To'lov turi")}</label>
            <Select value={method} onChange={(v) => setMethod(v)} options={methodOptions.map(({ m, bal }) => ({ value: m.key, label: `${m.name} (${t(fmtSum(bal))})` }))} placeholder={selectPlaceholder(methodsLoading, methodOptions.length, "Kassada mablag' yo'q")} clearable disabled={methodsLoading} />
            {available != null && (
              <div className="text-[12px] text-muted-foreground mt-1">Mavjud: {fmtUZS(available)}</div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Sanani tanlang")}</label>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button
            onClick={save}
            disabled={saving || salaryExceeds || salaryExhausted || studentBalanceExceeds}
            className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>{salaryOpen && selectedEmployee && (
        <EmployeeSalaryModal
          payroll={selectedPayroll}
          period={period}
          employeeName={selectedEmployee.name}
          onClose={() => setSalaryOpen(false)}
        />
      )}{groupsOpen && selectedStudent && (
        <StudentGroupsModal
          pupilId={selectedStudent.id}
          studentName={selectedStudent.name}
          balance={studentBalance}
          onClose={() => setGroupsOpen(false)}
        />
      )}</>
  );
}
