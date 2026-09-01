"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { invalidateBalances } from "@/lib/cacheKeys";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import DatePicker from "@/components/ui/DatePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import StudentGroupsModal from "./StudentGroupsModal";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import { useStudents } from "@/hooks/useStudents";
import type { TransactionType } from "@/lib/transactionTypes";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import { txTarget, txTargetLabel } from "@/lib/txTarget";
import { payrollDue, payrollEarned, payrollPeriod, payrollPeriodOf, type EmployeePayroll } from "@/lib/salary";
import { ROLE_LABELS } from "@/constants/employees";
import { invalidateTransactions } from "@/lib/cacheKeys";

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
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  mode: "chiqim";
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  const [category, setCategory] = useState("");
  // Tanlangan KIM — tranzaksiya turiga qarab o'quvchi yoki xodim.
  const [personName, setPersonName] = useState("");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  // O'quvchilar balansi (haqiqiy to'lovlar yig'indisi) — Kirim oynasidagi
  // bilan bir xil manba (/api/students/balances).
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Row[]>([{ id: 1, amount: "" }]);
  const [nextRowId, setNextRowId] = useState(2);
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  // Xodimlarning HAQIQIY oylik qatorlari — ism bo'yicha kalitlangan.
  const [payroll, setPayroll] = useState<Map<string, EmployeePayroll>>(new Map());
  // Tanlangan SANANING oyi — oylik hisobining davri ham, "shu oyda
  // allaqachon berilgan" so'rovi ham AYNAN shu oyga tegishli bo'lishi kerak.
  //
  // Ilgari `period` doim JORIY oy edi, `alreadyPaid` esa tanlangan sana
  // oyidan olinardi (pastdagi `/api/employee-salary-summary`). Kassir sanani
  // o'tgan oyga qo'yganda "hisoblangan oylik" sentabrniki, "olingan" esa
  // avgustniki bo'lib chiqardi — `remainingSalary` chegarasi ikki xil oydan
  // yig'ilardi va o'tgan oy uchun avans berishga to'sqinlik qilardi.
  const monthKey = useMemo(() => {
    if (!date) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}`;
  }, [date]);
  const period = useMemo(() => (monthKey ? payrollPeriodOf(monthKey) : payrollPeriod()), [monthKey]);

  // Maosh/guruh modali ochiq bo'lsa Escape faqat o'shani yopsin — aks holda
  // ikkala tinglovchi ham ishga tushib, chekma ham yopilib ketardi.
  useEscapeClose(salaryOpen || groupsOpen ? () => {} : onClose);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.types as TransactionType[]).filter((t) => t.mainType === "chiqim").map((t) => t.name);
        setCategories(Array.from(new Set(names)));
      });
    return () => { cancelled = true; };
  }, []);

  // Xodimlar ro'yxati faqat kerak bo'lganda (xodimga oylik/avans) yuklanadi.
  const target = txTarget(category);
  useEffect(() => {
    if (target !== "employee" || employees.length > 0) return;
    let cancelled = false;
    fetch("/api/hr-employees")
      .then((r) => r.json())
      .catch(() => null)
      .then((emps) => {
        if (cancelled || !emps?.ok) return;
        setEmployees(emps.employees as HrEmployee[]);
      });
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
    fetch(`/api/salary-runs/employees-payroll?month=${monthKey}`)
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
  // O'quvchilar tanlovi bazadan (/api/pupils).
  // Faqat ism va id kerak (selectedStudent.name/.id) — yengil ro'yxat yetadi.
  const { names: studentNames, byName: studentByName } = useStudents({ light: true });
  const roleOf = (name: string) => activeEmployees.find((e) => e.name === name)?.turi ?? "";
  const selectedEmployee = target === "employee" ? activeEmployees.find((e) => e.name === personName) : undefined;

  // O'quvchi balansi — faqat "o'quvchiga pul qaytarildi" turidagi
  // chiqimlarda kerak (target === "student"da har doim shu ma'no).
  const studentKey = (n: string) => n.trim().toLowerCase();
  const balanceOf = (n: string) => balances[studentKey(n)] ?? 0;
  const selectedStudent = target === "student" ? studentByName.get(studentKey(personName)) : undefined;
  const studentBalance = selectedStudent ? balanceOf(selectedStudent.name) : 0;

  useEffect(() => {
    if (target !== "student") return;
    let cancelled = false;
    loadBalancesCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [target]);

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const available = method ? cashbox.methodTotals[method as keyof CashboxMethodTotals] ?? 0 : null;

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
  const carryOver = selectedPayroll?.carryOver ?? 0;

  // Shu oyda xodimga necha marta oylik/avans chiqarilgani serverdan olinadi
  // (`monthKey` yuqorida, `period` bilan bir joyda hisoblangan). Sana yoki
  // xodim o'zgarsa qayta yuklanadi. Yig'indisi — `alreadyPaid`.
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  useEffect(() => {
    if (!isSalaryPayoutCategory || !selectedEmployee || !monthKey) {
      // Shart bajarilmasa qiymat allaqachon 0 — qayta o'rnatish shart emas
      // (effekt tanasidagi setState ortiqcha render zanjirini keltiradi).
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams({ name: selectedEmployee.name, month: monthKey });
    fetch(`/api/employee-salary-summary?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setAlreadyPaid(d.ok ? Number(d.paid) || 0 : 0);
      })
      .catch(() => { if (!cancelled) setAlreadyPaid(0); })
    return () => { cancelled = true; };
  }, [isSalaryPayoutCategory, selectedEmployee, monthKey]);

  // Chiqarish mumkin = hisoblangan oylik + o'tgan oydan qolgan − olingan.
  const remainingSalary = Math.max(0, employeeOylik + carryOver - alreadyPaid);
  // Oyligi sozlanmagan xodimga chegara qo'llanmaydi (server ham shunday) —
  // aks holda 0 deb o'qilib, hamma to'lov rad etilgan bo'lardi.
  const salaryExhausted = isSalaryPayoutCategory && !!selectedEmployee && salaryConfigured && remainingSalary <= 0;
  const salaryExceeds = isSalaryPayoutCategory && !!selectedEmployee && salaryConfigured && total > remainingSalary;

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
      showError("Tranzaksiya turini tanlang");
      return;
    }
    if (!total || total <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    if (!method) {
      showError("To'lov turini tanlang");
      return;
    }
    if (available != null && total > available) {
      showError("Mablag' yetarli emas");
      return;
    }
    if (salaryExhausted) {
      showError("Bu oyga xodim oyligi to'liq chiqarib bo'lingan — keyingi oygacha qo'shimcha pul chiqarib bo'lmaydi");
      return;
    }
    if (salaryExceeds) {
      showError(`Summa qolgan oylikdan (${fmtUZS(remainingSalary)}) ko'p bo'lishi mumkin emas`);
      return;
    }
    if (studentBalanceExceeds) {
      showError(`Summa o'quvchi balansidan (${fmtUZS(studentBalance)}) ko'p bo'lishi mumkin emas`);
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
          date: date ? toIso(date) : undefined,
          note,
        }),
      });
      const data = await res.json();
      invalidateTransactions(); // yangi tranzaksiya yozildi -> kesh bekor
      invalidateBalances();      // ...va o'quvchi balansi ham o'zgardi
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.cashbox as Cashbox);
      showSuccess("Chiqim amalga oshirildi");
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">Chiqim</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Tranzaksiya</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => {
                  // Tur o'zgarsa avval tanlangan kishi kerak bo'lmay qolishi
                  // mumkin (o'quvchi → xodim yoki umuman tanlovsiz tur).
                  if (txTarget(e.target.value) !== txTarget(category)) setPersonName("");
                  setCategory(e.target.value);
                }}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          {/* Kim tanlanishi tranzaksiya turiga bog'liq (lib/txTarget.ts):
              xodimga oylik/avans → xodimlar, o'quvchiga pul qaytarildi →
              o'quvchilar, qolgan turlarda (List, Printer, Suv…) tanlov
              umuman ko'rsatilmaydi. */}
          {target !== null && (
            <div className="space-y-2">
              <StudentSearchSelect
                label={txTargetLabel(target)}
                value={personName}
                onChange={setPersonName}
                options={target === "employee" ? activeEmployees.map((e) => e.name) : studentNames}
                placeholder={target === "employee" ? "Xodimni qidiring…" : "Tanlang"}
                subtitleOf={target === "employee" ? (n) => ROLE_LABELS[roleOf(n) as keyof typeof ROLE_LABELS] ?? roleOf(n) : undefined}
                // Ism yonida QOLGAN oylik: shu oynada aynan shuncha pul
                // chiqarish mumkin (jami hisoblangan emas).
                trailingOf={target === "employee" ? (n) => {
                  const p = payrollOf(n);
                  if (!p?.configured) return <span className="text-muted-foreground">Sozlanmagan</span>;
                  const due = Math.max(0, payrollDue(p, period));
                  return <span className={due > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(due)}</span>;
                } : target === "student" ? (n) => {
                  const b = balanceOf(n);
                  return <span className={b > 0 ? "text-emerald-600" : "text-muted-foreground"}>{fmtUZS(b)}</span>;
                } : undefined}
              />

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
                  <button
                    type="button"
                    onClick={() => setGroupsOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    O&apos;quvchi guruhlarini ko&apos;rish
                  </button>
                </div>
              )}

              {selectedEmployee && (
                <>
                  {/* Xodim tanlangach — nimadan qancha chiqarish mumkinligi. */}
                  {isSalaryPayoutCategory ? (
                    salaryConfigured ? (
                      <div className="text-[12.5px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2">
                        Chiqarish mumkin: <strong>{fmtUZS(remainingSalary)}</strong>
                        <span className="text-muted-foreground">
                          {" "}(Jami oylik {fmtUZS(employeeOylik)}
                          {carryOver > 0 ? ` + o'tgan oydan ${fmtUZS(carryOver)}` : ""}
                          {carryOver < 0 ? ` − o'tgan oy qarzdorligi ${fmtUZS(-carryOver)}` : ""}
                          {" "}− olingan {fmtUZS(alreadyPaid)})
                        </span>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-2">
                        Ish haqi sozlanmagan — chegara qo&apos;llanmaydi. Xodim profilida oylikni kiriting.
                      </div>
                    )
                  ) : (
                    <div className="text-[13px] text-muted-foreground">
                      {salaryConfigured ? `Oylik: ${fmtUZS(employeeOylik)}` : "Ish haqi sozlanmagan"}
                    </div>
                  )}
                  {isSalaryPayoutCategory && salaryExhausted && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      Bu oyga xodim oyligi to&apos;liq chiqarib bo&apos;lingan — keyingi oygacha qo&apos;shimcha pul chiqarib bo&apos;lmaydi.
                    </div>
                  )}
                  {isSalaryPayoutCategory && !salaryExhausted && salaryExceeds && (
                    <div className="text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/20 rounded-md px-2.5 py-1.5">
                      Summa qolgan oylikdan ({fmtUZS(remainingSalary)}) ko&apos;p bo&apos;lishi mumkin emas.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSalaryOpen(true)}
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
                  >
                    Xodim ma&apos;lumotlarini ko&apos;rish
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
                  <MoneyInput
                    value={row.amount}
                    onChange={(v) => updateRow(row.id, { amount: v })}
                    placeholder="Qiymat"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="h-10 w-10 shrink-0 rounded-lg border border-border text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                    title="O'chirish"
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
              title="Qator qo'shish"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Umumiy summa</label>
            <input
              value={groupNumber(total)}
              readOnly
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-secondary/30 px-3 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">To&apos;lov turi</label>
            <div className="relative">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {paymentMethods
                  .map((m) => ({ m, bal: cashbox.methodTotals[m.key as keyof CashboxMethodTotals] ?? 0 }))
                  .filter(({ bal }) => bal > 0)
                  .map(({ m, bal }) => (
                    <option key={m.key} value={m.key}>{`${m.name} (${fmtSum(bal)})`}</option>
                  ))}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
            {available != null && (
              <div className="text-[12px] text-muted-foreground mt-1">Mavjud: {fmtUZS(available)}</div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Sanani tanlang</label>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Izoh</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button
            onClick={save}
            disabled={saving || salaryExceeds || salaryExhausted || studentBalanceExceeds}
            className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>

      {/* Modal chekmadan (z-110) tepada turishi kerak — z-300. */}
      {salaryOpen && selectedEmployee && (
        <EmployeeSalaryModal
          payroll={selectedPayroll}
          period={period}
          employeeName={selectedEmployee.name}
          onClose={() => setSalaryOpen(false)}
        />
      )}
      {groupsOpen && selectedStudent && (
        <StudentGroupsModal
          pupilId={selectedStudent.id}
          studentName={selectedStudent.name}
          balance={studentBalance}
          onClose={() => setGroupsOpen(false)}
        />
      )}
    </div>
  );
}
