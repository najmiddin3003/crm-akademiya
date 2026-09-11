"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput from "@/components/ui/MoneyInput";
import { BONUS_TYPES } from "@/constants/bonuses";
import { loadPupilsCached, useStudents } from "@/hooks/useStudents";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Cashbox } from "@/lib/cashboxes";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";

// "Bonus yaratish" — Moliya → Bonus sahifasidagi o'ng tomondan ochiladigan
// panel (skrinshot 2/3). "Tranzaksiya turi"ga qarab pastda "Xodim" (oddiy
// tanlov, /api/hr-employees'dan) yoki "O'quvchi" (qidiruvli tanlov,
// /api/pupils'dan — bazadagi haqiqiy o'quvchilar) maydoni chiqadi.

/**
 * O'quvchi tanlovi — MODUL DARAJASIDA, ATAYLAB shu joyda.
 *
 * `useStudents({ light: true })` — 546 KB / 1407 ms / ~6765 o'quvchi —
 * endi FAQAT shu komponent mount bo'lganda ishga tushadi, ya'ni faqat
 * "O'quvchi" turi tanlanganda (oyna esa "Xodim" bilan ochiladi —
 * BONUS_TYPES[0], constants/bonuses.js). Standart yo'lda bu so'rov
 * UMUMAN ketmaydi.
 *
 * NEGA MODUL DARAJASIDA: BonusDrawer FUNKSIYASI ICHIDA e'lon qilinsa,
 * "Qiymat"/"Izoh" maydoniga har harf yozilganda YANGI komponent turi
 * hosil bo'lardi — React buni QAYTA MOUNT sifatida ko'radi va 546 KB
 * har harfda qaytadan ketardi. Bu tuzatilayotgan muammoni bir necha
 * barobar yomonlashtirardi.
 */
function StudentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { names: studentNames, loading: studentsLoading } = useStudents({ light: true });
  return (
    <StudentSearchSelect
      label="O'quvchi"
      value={value}
      onChange={onChange}
      options={studentNames}
      placeholder="O'quvchini qidirish"
      loading={studentsLoading}
    />
  );
}

export default function BonusDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (b: Bonus) => void;
}) {
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState(BONUS_TYPES[0].value);
  const [employeeName, setEmployeeName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  // Ikkala ro'yxat ham shu yerda yuklanadi — kelmaguncha "Tanlang"/"Tanlanmagan"
  // o'rniga "Yuklanmoqda…" turadi, aks holda bo'sh select "xodim yo'q ekan"
  // degan taassurot qoldiradi.
  const [listsLoading, setListsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
      // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
      fetch("/api/hr-employees/ref")
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.ok) setEmployees(d.employees); }),
      fetch("/api/cashboxes")
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.ok) setCashboxes(d.cashboxes); }),
    ]).finally(() => { if (!cancelled) setListsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recipientName = type === "employee" ? employeeName : studentName;

  async function save() {
    if (!recipientName) {
      showError(type === "employee" ? "Xodimni tanlang" : "O'quvchini tanlang");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      showError("Qiymatni to'g'ri kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipientName, amount: amountNum, note, cashboxId: cashboxId ? Number(cashboxId) : null }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.bonus as Bonus);
      showSuccess("Bonus yaratildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Tranzaksiya turi</label>
            {/* Ro'yxat TANLANGANDA emas, OCHILGANDA isiy boshlaydi (onOpen) —
                odatda 0.3-1.5 s oldinroq. Kalit bir xil ("pupils:light"),
                shu bois "O'quvchi" tanlansa StudentPicker mount bo'lganda
                in-flight dedup (lib/clientCache.ts) ikkinchi so'rovni
                yubormaydi. "Xodim" tanlangan holda qolsa — hech narsa isrof
                bo'lmaydi, chunki StudentPicker umuman mount bo'lmaydi. */}
            <Select
              value={type}
              onChange={(v) => { setType(v); setEmployeeName(""); setStudentName(""); }}
              onOpen={() => { void loadPupilsCached({ light: true }); }}
              options={BONUS_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>

          {type === "employee" ? (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Xodim</label>
              <Select value={employeeName} onChange={(v) => setEmployeeName(v)} options={employees.map((e) => ({ value: e.name, label: e.name }))} placeholder={selectPlaceholder(listsLoading, employees.length, "Xodim qo'shilmagan")} clearable disabled={listsLoading} />
            </div>
          ) : (
            <StudentPicker value={studentName} onChange={setStudentName} />
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Kassa</label>
            <Select value={cashboxId} onChange={(v) => setCashboxId(v)} options={cashboxes.map((c) => ({ value: String(c.id), label: c.name }))} placeholder={selectPlaceholder(listsLoading, cashboxes.length, "Kassa qo'shilmagan", "Tanlanmagan")} clearable disabled={listsLoading} />
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
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            Orqaga
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
  );
}
