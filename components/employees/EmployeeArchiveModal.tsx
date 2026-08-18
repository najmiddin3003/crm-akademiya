"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { EMP_LEAVE_REASONS, ROLE_LABELS } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";

// Xodimni arxivlash / arxivdan chiqarish modali.
//
// Referens (akademiya.edutizim.uz → /hr/employees/profile/:id) xodimni
// O'CHIRMAYDI — uni arxivlaydi. Tugma profil kartochkasidagi to'rtta
// ikonkadan ikkinchisi, tooltipi "<Rol>ni arxivlash". Modal ikki maydon
// so'raydi (referensdagi `reasonResignId` + `dateResign`), va teskari amal
// ham bor (`activate`). Bizda alohida "holat" maydoni yo'q: `archReason`
// to'ldirilgan bo'lsa — arxiv, bo'sh bo'lsa — aktiv (EmployeesListPage
// dagi "Holat" filtri ham aynan shu belgiga qaraydi).
//
// Saqlash: PATCH /api/hr-employees/:id — mavjud route `Partial<HrEmployee>`
// qabul qiladi, shuning uchun yangi endpoint kerak emas.

export type ArchiveMode = "archive" | "activate";

interface Props {
  employee: HrEmployee;
  mode: ArchiveMode;
  onClose: () => void;
  onDone: (updated: HrEmployee) => void;
}

/** "YYYY-MM-DD" (input type=date) → "DD.MM.YYYY" (loyihada saqlanadigan format). */
function toStoredDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** Bugungi sana "YYYY-MM-DD" ko'rinishida (input type=date uchun). */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

export default function EmployeeArchiveModal({ employee, mode, onClose, onDone }: Props) {
  const [reason, setReason] = useState(EMP_LEAVE_REASONS[0]);
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEscapeClose(onClose);

  const roleLabel = ROLE_LABELS[employee.turi as keyof typeof ROLE_LABELS] ?? "Xodim";
  const isArchive = mode === "archive";

  // Referensda arxivlashdan oldin `hasStudents` / `hasOrders` tekshiriladi.
  // Bizda ekvivalenti — aktiv o'quvchilar va guruhlar soni. Bloklamaymiz,
  // ogohlantiramiz: qaysi biri boshqa xodimga o'tkazilishi kerakligini
  // ko'rsatish foydaliroq.
  const busy: string[] = [];
  if (isArchive && employee.aktivOq > 0) busy.push(`${employee.aktivOq} ta aktiv o'quvchi`);
  if (isArchive && employee.groups > 0) busy.push(`${employee.groups} ta guruh`);

  async function submit() {
    setError("");
    if (isArchive) {
      if (!reason) {
        setError("Ketish sababini tanlang");
        return;
      }
      if (!toStoredDate(date)) {
        setError("Sanani to'g'ri kiriting");
        return;
      }
    }

    // Arxivlash — sabab + sana yoziladi; arxivdan chiqarish — ikkalasi tozalanadi.
    const body = isArchive
      ? { archReason: reason, archDate: toStoredDate(date) }
      : { archReason: "", archDate: "" };

    setSaving(true);
    try {
      const res = await fetch(`/api/hr-employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Saqlanmadi");
        return;
      }
      onDone(data.employee as HrEmployee);
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    // Saqlash ketayotganda fon bosilsa modal yopilmasin — so'rov yarim yo'lda
    // qolib, natijasi ko'rinmay ketardi (loyihadagi tasdiq oynalari naqshi).
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">
          {isArchive ? `${roleLabel}ni arxivlash` : `${roleLabel}ni arxivdan chiqarish`}
        </h3>

        {/* Matnlar JSX matn tugunlari emas, satr IFODALARI sifatida yozilgan.
            Ko'p qatorli JSX matnining bosh/oxirgi probeli qirqiladi va
            "Ismarxivga" bo'lib qoladi — README'dagi tuzoq. */}
        <p className="text-[13px] text-muted-foreground">
          <span className="text-foreground font-medium">{employee.name}</span>
          {isArchive
            ? " arxivga o'tkaziladi. U ro'yxatdan yo'qolmaydi — «Holat: Arxiv» filtri orqali topiladi va istalgan vaqtda qaytariladi."
            : " yana aktiv xodimlar qatoriga qaytadi, ketish sababi va sanasi o'chiriladi."}
        </p>

        {busy.length > 0 && (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-700">
            <AlertTriangle className="icon icon-sm flex-shrink-0 mt-0.5" />
            <span>
              {`Bu xodimda ${busy.join(" va ")} bor. Arxivlashdan oldin ularni boshqa xodimga o'tkazish tavsiya etiladi.`}
            </span>
          </div>
        )}

        {isArchive && (
          <>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Ketish sababi</label>
              <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
                {EMP_LEAVE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">Ketish sanasi</label>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        )}

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          {/* `components/ui/Button.tsx` da disabled uslubi yo'q — loyihadagi
              boshqa modallar kabi `disabled:opacity-60` qo'lda qo'shiladi. */}
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="disabled:opacity-60">
            Bekor qilish
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={saving} className="disabled:opacity-60">
            {saving ? "Saqlanmoqda..." : isArchive ? "Arxivlash" : "Arxivdan chiqarish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
