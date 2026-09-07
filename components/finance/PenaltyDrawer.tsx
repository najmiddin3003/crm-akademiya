"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import MoneyInput from "@/components/ui/MoneyInput";
import { PENALTY_TYPES } from "@/constants/penalties";
import { useStudents } from "@/hooks/useStudents";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Penalty } from "@/lib/penalties";
import type { Cashbox } from "@/lib/cashboxes";

// "Jarima qo'shish" — Moliya → Jarima sahifasidagi o'ng tomondan ochiladigan
// panel. Bonus bilan bir xil "Tranzaksiya turi" → Xodim/O'quvchi mantig'i
// (BonusDrawer'ga qarang), farqi — oxirida "Rasm" (fayl) maydoni bor.
//
// ILGARI rasm HECH QAYERGA yuklanmasdi: faqat faylning NOMI ("dalil.jpg")
// bazaga yozilardi, ya'ni jadvaldagi "Rasm" ustuni ochib bo'lmaydigan matn
// edi — jarimaga dalil biriktirdim degan yolg'on. Endi fayl haqiqatan
// /api/upload/image orqali Cloudinary'ga yuklanadi va `image` maydonida
// URL saqlanadi (components/employees/AddEmployeeModal.tsx bilan bir xil
// qolip). Yuklash muvaffaqiyatsiz bo'lsa saqlash TO'XTAYDI — jarima
// rasmsiz yozilib, foydalanuvchi buni sezmay qolmasin.
export default function PenaltyDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (p: Penalty) => void;
}) {
  useEscapeClose(onClose);
  // Faqat ismlar ro'yxati kerak — yengil rejim (3 654 KB → 544 KB).
  const { names: studentNames, loading: studentsLoading } = useStudents({ light: true });
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [cashboxId, setCashboxId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  // Faylning o'zi saqlanadi (nomi emas) — saqlashda u yuklanadi.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!type) {
      showError("Tranzaksiya turini tanlang");
      return;
    }
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
      // Rasm avval yuklanadi; xato bo'lsa jarima umuman yozilmaydi.
      let imageUrl = "";
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("folder", "jarimalar");
        const up = await fetch("/api/upload/image", { method: "POST", body: fd });
        const upData = await up.json();
        if (!up.ok || !upData.ok) {
          showError(upData.error || "Rasm yuklanmadi");
          setSaving(false);
          return;
        }
        imageUrl = upData.url as string;
      }

      const res = await fetch("/api/penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipientName, amount: amountNum, note, image: imageUrl, cashboxId: cashboxId ? Number(cashboxId) : null }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.penalty as Penalty);
      showSuccess("Jarima qo'shildi");
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
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-1.5">Tranzaksiya turi</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setEmployeeName(""); setStudentName(""); }}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Tanlang</option>
                {PENALTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
          </div>

          {type === "employee" && (
            <div>
              <label className="block text-[13px] font-medium mb-1.5">Xodim</label>
              <div className="relative">
                <select
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  disabled={listsLoading}
                  className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
                >
                  <option value="">{selectPlaceholder(listsLoading, employees.length, "Xodim qo'shilmagan")}</option>
                  {employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
                <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </div>
            </div>
          )}
          {type === "student" && (
            <StudentSearchSelect
              label="O'quvchi"
              value={studentName}
              onChange={setStudentName}
              options={studentNames}
              placeholder="O'quvchini qidirish"
              loading={studentsLoading}
            />
          )}

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Kassa</label>
            <div className="relative">
              <select
                value={cashboxId}
                onChange={(e) => setCashboxId(e.target.value)}
                disabled={listsLoading}
                className="w-full h-10 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70"
              >
                {/* "Tanlanmagan" — haqiqiy tanlov (kassasiz jarima), shuning
                    uchun u `ready` matni sifatida saqlanadi. */}
                <option value="">{selectPlaceholder(listsLoading, cashboxes.length, "Kassa qo'shilmagan", "Tanlanmagan")}</option>
                {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <svg className="icon icon-xs pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </div>
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

          <div>
            <label className="block text-[13px] font-medium mb-1.5">Rasm</label>
            {/* Endpoint faqat PNG/JPG/WEBP va 5 MB gacha qabul qiladi
                (app/api/upload/image/route.ts) — tanlash oynasi ham shu
                turlar bilan cheklanadi. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-10 flex items-center justify-between rounded-lg border border-border bg-card px-3 text-sm hover:bg-secondary"
            >
              <span className={imageFile ? "truncate" : "text-muted-foreground"}>{imageFile?.name || "Faylni tanlash"}</span>
              <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
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
