"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import DatePicker from "@/components/ui/DatePicker";
import MonthYearPicker, { type MonthYearValue } from "@/components/ui/MonthYearPicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import MoneyInput, { groupNumber } from "@/components/ui/MoneyInput";
import { STUDENTS_LIST } from "@/constants/studentsList";
import type { TransactionType } from "@/lib/transactionTypes";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import type { HrEmployee } from "@/lib/hrEmployees";
import { txTarget, txTargetLabel } from "@/lib/txTarget";
import { salaryOf } from "@/lib/employeeSalary";

const STUDENT_NAMES = STUDENTS_LIST.map((s) => s.name);

function fmtUZS(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function defaultMonth(): MonthYearValue {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

interface Row {
  id: number;
  amount: string;
  month: MonthYearValue | null;
}

// Kassalar sahifasidagi "- Chiqim" — referens saytdagi oyna: Tranzaksiya
// (xarajat turi), O'quvchini tanlang, so'ng bir nechta (Qiymat + Oyni
// tanlang) qatorlari — "+" bosilsa yana bir qator qo'shiladi (masalan bir
// xarajatni bir nechta oyga bo'lib yozish uchun), ularning yig'indisi
// "Umumiy summa"da avtomatik ko'rsatiladi. Pul harakati (methodTotals/
// balance) shu umumiy summa bo'yicha /api/cashboxes/:id/adjust orqali
// HAQIQIY, kategoriya/o'quvchi/sana/izoh bilan birga — "Tranzaksiyalar" va
// "Moliya hisobotlari/analitikasi" ko'radigan haqiqiy jurnalga yoziladi
// (har bir qatorning oyi hozircha faqat shu oynada — xarajat bitta yagona
// yozuv sifatida jurnalga tushadi). "Tranzaksiya" ro'yxati — Moliya →
// Tranzaksiya turi (/finance-tx-types) sahifasidagi HAQIQIY, admin
// boshqaradigan ro'yxatdan (mainType: "chiqim").
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
  const [rows, setRows] = useState<Row[]>([{ id: 1, amount: "", month: defaultMonth() }]);
  const [nextRowId, setNextRowId] = useState(2);
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Maosh modali ochiq bo'lsa Escape faqat o'shani yopsin — aks holda ikkala
  // tinglovchi ham ishga tushib, chekma ham yopilib ketardi.
  useEscapeClose(salaryOpen ? () => {} : onClose);

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
      .then((d) => {
        if (!cancelled && d.ok) setEmployees(d.employees as HrEmployee[]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [target, employees.length]);

  // Arxivdagi xodimga oylik berilmaydi — ro'yxatda faqat aktivlar.
  const activeEmployees = employees.filter((e) => !e.archReason);
  const selectedEmployee = target === "employee" ? activeEmployees.find((e) => e.name === personName) : undefined;

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const available = method ? cashbox.methodTotals[method as keyof CashboxMethodTotals] ?? 0 : null;

  function addRow() {
    setRows((prev) => [...prev, { id: nextRowId, amount: "", month: defaultMonth() }]);
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
                options={target === "employee" ? activeEmployees.map((e) => e.name) : STUDENT_NAMES}
                placeholder="Tanlang"
              />

              {selectedEmployee && (
                <>
                  <div className="text-[13px] text-muted-foreground">
                    {`Oylik: ${fmtUZS(salaryOf(selectedEmployee.id).oylik)}`}
                  </div>
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
                <div className="flex-1">
                  <label className="block text-[13px] font-medium mb-1.5">
                    Oyni tanlang<span className="text-red-500"> *</span>
                  </label>
                  <MonthYearPicker value={row.month} onChange={(v) => updateRow(row.id, { month: v })} />
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
                {paymentMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
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
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>

      {/* Modal chekmadan (z-110) tepada turishi kerak — z-300. */}
      {salaryOpen && selectedEmployee && (
        <EmployeeSalaryModal
          employeeId={selectedEmployee.id}
          employeeName={selectedEmployee.name}
          onClose={() => setSalaryOpen(false)}
        />
      )}
    </div>
  );
}
