"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { useBranches } from "@/hooks/useBranches";
import EmployeeToggle from "./EmployeeToggle";
import CustomFieldDrawer from "./CustomFieldDrawer";
import type { HrEmployee } from "@/lib/hrEmployees";

// Xodim qo'shish modali (crm-akademiya #emp-add-modal, skrinshot 2 tartibida).
// Saqlash → POST /api/hr-employees (asosiy maydonlar: ism+familiya, telefon,
// vazifa→turi, jinsi→gender, email); ish haqi/rollar/maxsus maydonlar hozircha
// yuborilmaydi. "Maxsus maydon qo'shish" o'ngdan CustomFieldDrawer'ni ochadi.
const selectCls =
  "w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const inputCls =
  "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

function Chevron() {
  return (
    <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      <use href="#i-chevron-down" />
    </svg>
  );
}

const TURI_MAP: Record<string, string> = { "O'qituvchi": "teacher", Moderator: "moderator", Administrator: "admin" };
const GENDER_MAP: Record<string, string> = { Erkak: "male", Ayol: "female" };

// lib/invite.ts dagi isValidPhone/normalizePhone bilan bir xil qoida —
// u yerdagi funksiyalarni to'g'ridan-to'g'ri import qilmaymiz (crypto/bcryptjs
// ishlatadi, klient tomonga mos emas), shuning uchun shu yerda takrorlangan.
function isValidPhoneClient(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.length === 9 ? "998" + digits : digits;
  return /^998\d{9}$/.test(normalized);
}

export default function AddEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (emp: HrEmployee) => void }) {
  useEscapeClose(onClose);
  const { showSuccess, showError } = useToast();
  // Filial qatorlari Boshqaruv → Filiallar bilan bir xil manbadan.
  const { branches } = useBranches();
  const [ism, setIsm] = useState("");
  const [familiya, setFamiliya] = useState("");
  const [phone, setPhone] = useState("+998");
  const [vazifa, setVazifa] = useState("");
  const [jinsi, setJinsi] = useState("");
  const [email, setEmail] = useState("");
  const [payroll, setPayroll] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [sameForAll, setSameForAll] = useState(true);
  const [showCustomField, setShowCustomField] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = `${ism.trim()} ${familiya.trim()}`.trim();
    if (!name) {
      showError("Ism va familiyani kiriting");
      return;
    }
    const trimmedPhone = phone.trim();
    if (!isValidPhoneClient(trimmedPhone)) {
      showError("Telefon raqamini to'g'ri kiriting (masalan +998 90 123 45 67)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/hr-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: trimmedPhone,
          turi: TURI_MAP[vazifa] || "",
          gender: GENDER_MAP[jinsi] || "",
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Xodim qo'shilmadi");
        setSaving(false);
        return;
      }
      onCreated?.(data.employee as HrEmployee);
      if (data.smsSent) {
        showSuccess(`Xodim qo'shildi — ${name}. Faollashtirish SMS'i yuborildi.`);
      } else {
        showError(`Xodim qo'shildi — ${name}, lekin faollashtirish SMS'i yuborilmadi. Birozdan so'ng qayta urinib ko'ring.`);
      }
      onClose();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-[16px] font-semibold">Xodim qo&apos;shish</h3>
          <p className="text-[11px] text-muted-foreground"><span className="text-rose-500">*</span> Zarurligini bildiradi</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Row 1: Ism / Familiya / Telefon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Ism<span className="text-rose-500">*</span></label>
              <input type="text" value={ism} onChange={(e) => setIsm(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Familiya<span className="text-rose-500">*</span></label>
              <input type="text" value={familiya} onChange={(e) => setFamiliya(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Telefon raqam<span className="text-rose-500">*</span></label>
              <div className="flex items-center gap-2 h-10 rounded-lg border border-border bg-card pl-2 pr-3">
                <span className="inline-block text-[16px]">🇺🇿</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Vazifa / Jinsi / Tug'ilgan sanasi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>O&apos;quv markazidagi vazifasi<span className="text-rose-500">*</span></label>
              <div className="relative">
                <select className={selectCls} value={vazifa} onChange={(e) => setVazifa(e.target.value)}>
                  <option value="">Tanlang</option>
                  <option>O&apos;qituvchi</option>
                  <option>Moderator</option>
                  <option>Administrator</option>
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className={labelCls}>Jinsi</label>
              <div className="relative">
                <select className={selectCls} value={jinsi} onChange={(e) => setJinsi(e.target.value)}>
                  <option value="">Jinsini tanlang</option>
                  <option>Erkak</option>
                  <option>Ayol</option>
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tug&apos;ilgan sanasi</label>
              <input type="date" className={inputCls} />
            </div>
          </div>

          {/* Ish haqi chiqarish toggle */}
          <EmployeeToggle checked={payroll} onChange={setPayroll} label="Ish haqi chiqarish" />

          {/* Filiallar / Rollar / Ish jadvali / Ish haqi */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-[13px] font-semibold">
              <div>Filiallar</div>
              <div>Rollar</div>
              <div>Ish jadvali</div>
              <div className="flex items-center justify-between">
                <span>Ish haqi</span>
                <label className="flex items-center gap-1 font-normal text-[12px] cursor-pointer">
                  <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} className="w-4 h-4 rounded accent-primary" /> Hammasiga bir xil
                </label>
              </div>
            </div>
            {branches.map((branch) => (
              <div key={branch.id} className="grid grid-cols-4 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" />
                  <span className="text-sm">{branch.name}</span>
                </label>
                <div className="relative">
                  <select className={selectCls} defaultValue=""><option value="">Rolni tanlang</option></select>
                  <Chevron />
                </div>
                <div className="relative">
                  <select className={selectCls} defaultValue=""><option value="">Ish jadvali</option></select>
                  <Chevron />
                </div>
                <input type="text" placeholder="Ish haqini kiriting" className={inputCls} />
              </div>
            ))}
          </div>

          {/* Izoh */}
          <div>
            <label className={labelCls}>Izoh</label>
            <textarea rows={2} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {/* Elektron pochta / Profil rasmi / Ikki bosqichli tasdiqlash */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Elektron pochta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Profil rasmi</label>
              <button type="button" className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-left flex items-center justify-between hover:bg-secondary/30">
                <span className="inline-flex items-center gap-2 text-muted-foreground"><Upload className="icon icon-sm" /> Profil rasmi</span>
                <span className="text-[10px] font-semibold text-muted-foreground">PNG, JPG</span>
              </button>
            </div>
            <div className="flex items-end">
              <EmployeeToggle checked={twoFactor} onChange={setTwoFactor} label="Ikki bosqichli tasdiqlash" />
            </div>
          </div>

          {/* Maxsus maydon qo'shish */}
          <button
            type="button"
            onClick={() => setShowCustomField(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
          >
            <Plus className="icon icon-sm" />
            <span>Maxsus maydon qo&apos;shish</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary">Orqaga</button>
          <button onClick={save} disabled={saving} className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saqlanmoqda…" : "Saqlash"}</button>
        </div>
      </div>

      {showCustomField && (
        <CustomFieldDrawer
          onClose={() => setShowCustomField(false)}
          onSave={(name) => {
            setShowCustomField(false);
            showSuccess(name ? `Maxsus maydon qo'shildi — ${name}` : "Maxsus maydon qo'shildi (demo)");
          }}
        />
      )}
    </div>
  );
}
