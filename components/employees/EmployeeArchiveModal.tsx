"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { EMP_LEAVE_REASONS, ROLE_LABELS } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

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

export default function EmployeeArchiveModal({ employee, mode, onClose, onDone }: Props) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [reason, setReason] = useState(EMP_LEAVE_REASONS[0]);
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  const roleLabel = ROLE_LABELS[employee.turi as keyof typeof ROLE_LABELS] ?? "Xodim";
  const isArchive = mode === "archive";

  // Referensda arxivlashdan oldin `hasStudents` / `hasOrders` tekshiriladi.
  // Bizda ekvivalenti — aktiv o'quvchilar va guruhlar soni. Bloklamaymiz,
  // ogohlantiramiz: qaysi biri boshqa xodimga o'tkazilishi kerakligini
  // ko'rsatish foydaliroq.
  const busy: string[] = [];
  if (isArchive && employee.aktivOq > 0) busy.push(t("{aktivOq} ta aktiv o'quvchi", { aktivOq: employee.aktivOq }));
  if (isArchive && employee.groups > 0) busy.push(`${employee.groups} ta guruh`);

  async function submit() {
    setError("");
    if (isArchive) {
      if (!reason) {
        setError(t("Ketish sababini tanlang"));
        return;
      }
      if (!toStoredDate(date)) {
        setError(t("Sanani to'g'ri kiriting"));
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
        setError(t(data.error || "Saqlanmadi"));
        return;
      }
      onDone(data.employee as HrEmployee);
    } catch {
      setError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    // Saqlash ketayotganda fon bosilsa modal yopilmasin — so'rov yarim yo'lda
    // qolib, natijasi ko'rinmay ketardi (loyihadagi tasdiq oynalari naqshi).
    <Modal onClose={onClose} controller={modal} locked={saving} bare zIndex={200} panelClassName="p-5 space-y-4 overflow-y-auto">
        <h3 className="text-lg font-semibold">
          {isArchive ? `${roleLabel}ni arxivlash` : `${roleLabel}ni arxivdan chiqarish`}
        </h3>

        {/* Matnlar JSX matn tugunlari emas, satr IFODALARI sifatida yozilgan.
            Ko'p qatorli JSX matnining bosh/oxirgi probeli qirqiladi va
            "Ismarxivga" bo'lib qoladi — README'dagi tuzoq. */}
        <p className="text-[13px] text-muted-foreground">
          <span className="text-foreground font-medium">{employee.name}</span>
          {isArchive
            ? t(" arxivga o'tkaziladi. U ro'yxatdan yo'qolmaydi — «Holat: Arxiv» filtri orqali topiladi va istalgan vaqtda qaytariladi.")
            : t(" yana aktiv xodimlar qatoriga qaytadi, ketish sababi va sanasi o'chiriladi.")}
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
              <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{t("Ketish sababi")}</label>
              <Select value={reason} onChange={(v) => setReason(v)} options={EMP_LEAVE_REASONS.map((r) => ({ value: r, label: r }))} size="sm" />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{t("Ketish sanasi")}</label>
              <DateField value={date} onChange={(v) => setDate(v)} />
            </div>
          </>
        )}

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          {/* `components/ui/Button.tsx` da disabled uslubi yo'q — loyihadagi
              boshqa modallar kabi `disabled:opacity-40` qo'lda qo'shiladi. */}
          <Button type="button" variant="outline" onClick={modal.close} disabled={saving} className="disabled:opacity-40">
            {t("Bekor qilish")}
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={saving} className="disabled:opacity-40">
            {saving ? "Saqlanmoqda..." : isArchive ? t("Arxivlash") : t("Arxivdan chiqarish")}
          </Button>
        </div>
      </Modal>
  );
}
