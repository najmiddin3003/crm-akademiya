"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { invalidateBalances } from "@/lib/cacheKeys";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import DatePicker from "@/components/ui/DatePicker";
import MonthYearPicker from "@/components/ui/MonthYearPicker";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput from "@/components/ui/MoneyInput";
import { useTeachers } from "@/hooks/useTeachers";
import { useStudents } from "@/hooks/useStudents";
import type { TransactionType } from "@/lib/transactionTypes";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { type Cashbox } from "@/lib/cashboxes";
import { invalidateTransactions } from "@/lib/cacheKeys";

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
  const { active: paymentMethods, loading: methodsLoading } = usePaymentMethods();
  const { showSuccess, showError } = useToast();
  // O'qituvchi ro'yxati bazadan — bu qiymat tranzaksiyaga yoziladi va
  // ISM bo'yicha oylik hisobiga ulanadi (lib/payrollSources.ts), shu bois
  // qattiq ro'yxatdagi ism tushumni hech kimga biriktirmasdi.
  const { teachers, names: teacherNames, loading: teachersLoading } = useTeachers();
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
  // QAYSI OY uchun tolov. Sana — pul KELGAN kun, bu esa tolov qaysi
  // davrga tegishli ekani: sentabrda kelgan pul avgust darslari uchun
  // bolishi mumkin. Sukut — tanlangan sananing oyi, yani odatdagi holatda
  // kassir hech narsa qilmaydi.
  const [periodMonth, setPeriodMonth] = useState<string>(() => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  // Tranzaksiya turlari xom `fetch` bilan olinadi (hook yo’q), shuning
  // uchun yuklanish holati shu yerda yaratiladi.
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // O'quvchilar bazadan (/api/pupils). Ism → o'quvchi kartasi (telefon va
  // profil havolasi uchun): to'lov yozuvida faqat ism saqlanadi, id emas.
  // Faqat ism/telefon/id kerak (phoneOf, selectedStudent.phone/.id) — yengil
  // ro'yxat yetadi. Bu sahifada CashboxesPage ham yengil ro'yxatni oladi,
  // ya'ni drawer ochilganda so'rov umuman ketmaydi (kesh mos keladi).
  const { names: studentNames, byName: studentByName, loading: studentsLoading } = useStudents({ light: true });

  const key = (n: string) => n.trim().toLowerCase();
  const phoneOf = (n: string) => {
    const s = studentByName.get(key(n));
    return s?.phone ? `+998 ${s.phone}` : "";
  };
  // O'qituvchi telefoni — tanlash ro'yxatidagi ikkinchi satr. Qidiruv shu
  // satrni ham qamrab oladi (StudentSearchSelect → haystackOf), shuning
  // uchun o'qituvchini telefon raqami bo'yicha ham topsa bo'ladi.
  const teacherByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) {
      const k = key(t.name);
      if (!map.has(k)) map.set(k, t.phone ? `+998 ${t.phone}` : "");
    }
    return map;
  }, [teachers]);
  const teacherPhoneOf = (n: string) => teacherByName.get(key(n)) ?? "";
  const balanceOf = (n: string) => balances[key(n)] ?? 0;
  const selectedStudent = studentName ? studentByName.get(key(studentName)) : undefined;
  const selectedBalance = studentName ? balanceOf(studentName) : 0;

  useEffect(() => {
    let cancelled = false;
    loadBalancesCached().then((b)=>{ if(!cancelled) setBalances(b); }).catch(()=>{});
    fetch("/api/transaction-types")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        const names = (d.types as TransactionType[]).filter((t) => t.mainType === "kirim").map((t) => t.name);
        const uniq = Array.from(new Set(names));
        setCategories(uniq);
        // Moliya → Tranzaksiya turi sahifasining "Kirim" tabida BIRINCHI
        // turgan tur avtomatik tanlanadi (tartib API'dagi id bo'yicha).
        if (uniq.length > 0) setCategory((cur) => cur || uniq[0]);
      })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });
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
          periodMonth,
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
                disabled={categoriesLoading}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
              >
                <option value="">{selectPlaceholder(categoriesLoading, categories.length, "Kirim turi qo’shilmagan")}</option>
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
            {/* O'quvchi tanlovi bilan bir xil qidiruvli ro'yxat. Ilgari bu
                oddiy <select> edi: bazada 43 o'qituvchi bor va kerakligini
                topish uchun butun ro'yxatni aylantirishga to'g'ri kelardi,
                telefon raqami esa umuman ko'rinmasdi. */}
            <StudentSearchSelect
              label="O'qituvchini tanlang"
              value={teacherName}
              onChange={setTeacherName}
              options={teacherNames}
              loading={teachersLoading}
              placeholder="Ism yoki telefon bo'yicha qidiring…"
              subtitleOf={(n) => teacherPhoneOf(n)}
            />
          </div>

          <div>
            <StudentSearchSelect
              label="O'quvchini tanlang"
              value={studentName}
              onChange={setStudentName}
              options={studentNames}
              loading={studentsLoading}
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
                disabled={methodsLoading}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
              >
                <option value="">{selectPlaceholder(methodsLoading, paymentMethods.length, "To’lov turi qo’shilmagan")}</option>
                {paymentMethods.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Sanani tanlang</label>
              <DatePicker
                value={date}
                onChange={(d) => {
                  setDate(d);
                  // Sana o'zgarsa oy ham ergashadi — kassir odatda bugungi
                  // kun uchun to'lov qabul qiladi va ikkinchi maydonga
                  // umuman tegishi shart emas.
                  if (d) setPeriodMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Qaysi oy uchun</label>
              <MonthYearPicker
                className="w-full"
                value={{ month: Number(periodMonth.slice(5, 7)), year: Number(periodMonth.slice(0, 4)) }}
                onChange={(v) => setPeriodMonth(`${v.year}-${String(v.month).padStart(2, "0")}`)}
              />
            </div>
          </div>
          {/* To'lov sanasi va u qoplaydigan oy HAR DOIM bir xil emas:
              sentabrda kelgan pul avgust darslari uchun bo'lishi mumkin.
              O'qituvchining foizli oyligi aynan shu oyga hisoblanadi. */}
          {periodMonth !== (date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "") && (
            <p className="-mt-1 text-[11px] text-amber-600">
              To&apos;lov {periodMonth} oyiga yoziladi — o&apos;qituvchining o&apos;sha oydagi oyligiga qo&apos;shiladi.
            </p>
          )}

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
