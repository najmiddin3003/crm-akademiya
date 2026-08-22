"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import DatePicker from "@/components/ui/DatePicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput from "@/components/ui/MoneyInput";
import { GROUP_TEACHERS } from "@/constants/groups";
import { useStudents } from "@/hooks/useStudents";
import type { TransactionType } from "@/lib/transactionTypes";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";

function fmtSom(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " so'm";
}

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  onClose,
  onSaved,
}: {
  cashbox: Cashbox;
  onClose: () => void;
  onSaved: (c: Cashbox) => void;
}) {
  useEscapeClose(onClose);
  // To'lov turlari Sozlamalar → Moliya → To'lov turlaridan (faqat faollari).
  const { active: paymentMethods } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  const [category, setCategory] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [studentName, setStudentName] = useState("");
  // Bo'sh boshlanadi — ilgari maydonda "0" turar va uni har safar
  // o'chirishga to'g'ri kelardi.
  const [amount, setAmount] = useState("");
  // O'quvchilar balansi (haqiqiy to'lovlar yig'indisi) — tanlash
  // ro'yxatida va tanlangandan keyin ko'rsatiladi.
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("");
  const [date, setDate] = useState<Date | null>(new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  // O'quvchilar bazadan (/api/pupils). Ism → o'quvchi kartasi (telefon va
  // profil havolasi uchun): to'lov yozuvida faqat ism saqlanadi, id emas.
  const { names: studentNames, byName: studentByName } = useStudents();

  const key = (n: string) => n.trim().toLowerCase();
  const phoneOf = (n: string) => {
    const s = studentByName.get(key(n));
    return s?.phone ? `+998 ${s.phone}` : "";
  };
  const balanceOf = (n: string) => balances[key(n)] ?? 0;
  const selectedStudent = studentName ? studentByName.get(key(studentName)) : undefined;
  const selectedBalance = studentName ? balanceOf(studentName) : 0;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/students/balances").then((r)=>r.json()).then((d)=>{ if(!cancelled && d.ok) setBalances(d.balances); }).catch(()=>{});
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.types as TransactionType[]).filter((t) => t.mainType === "kirim").map((t) => t.name);
        setCategories(Array.from(new Set(names)));
      });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!category) {
      showError("Tranzaksiya turini tanlang");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    if (!method) {
      showError("To'lov turini tanlang");
      return;
    }
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
          teacherName,
          studentName,
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
      showSuccess("Kirim qo'shildi");
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
          <h3 className="text-[16px] font-semibold flex-1">Kirim</h3>
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
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Tozalash"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">O&apos;qituvchini tanlang</label>
            <div className="relative">
              <select
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {GROUP_TEACHERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          <div>
            <StudentSearchSelect
              label="O'quvchini tanlang"
              value={studentName}
              onChange={setStudentName}
              options={studentNames}
              placeholder="Ism yoki telefon bo'yicha qidiring…"
              subtitleOf={(n) => phoneOf(n)}
              trailingOf={(n) => {
                const b = balanceOf(n);
                return <span className={b < 0 ? "text-rose-600" : "text-muted-foreground"}>{fmtSom(b)}</span>;
              }}
            />
            {/* Tanlangandan keyin — balans va telefon. */}
            {selectedStudent && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-[12px]">
                <div>
                  Balans:{" "}
                  <strong className={selectedBalance < 0 ? "text-rose-600" : "text-emerald-600"}>{fmtSom(selectedBalance)}</strong>
                  {selectedStudent.phone && <span className="text-muted-foreground"> · +998 {selectedStudent.phone}</span>}
                </div>
                <Link
                  href={`/student-edit/${selectedStudent.id}?src=list`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  O&apos;quvchi profilini ko&apos;rish
                </Link>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Qiymat</label>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
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
    </div>
  );
}
