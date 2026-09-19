"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import DatePicker from "@/components/ui/DatePicker";
import MoneyInput from "@/components/ui/MoneyInput";
import { useModerators } from "@/hooks/useModerators";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import type { StudentRow } from "@/lib/studentsData";
import type { FinanceContract, ContractPart } from "@/lib/financeContracts";
import Select from "@/components/ui/Select";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// "Shartnoma yaratish" — Moliya → Shartnoma sahifasidagi o'ng tomondan
// ochiladigan panel. `contract` berilsa — tahrirlash (PATCH
// /api/finance-contracts/:id), aks holda qo'shish (POST /api/finance-contracts).
//
// ILGARI NIMA NOTO'G'RI EDI:
//   • O'quvchi ro'yxati `createInitialOrders()` — 502 ta o'ylab topilgan
//     buyurtmadan kelardi, ya'ni bazada mavjud bo'lmagan odamga shartnoma
//     tuzish mumkin edi. Endi ro'yxat /api/pupils dan (sahifadagi
//     useStudents) uzatiladi.
//   • Moderator qattiq yozilgan DEFAULT_MODERATOR = "Husanboy Sotiboldiyev"
//     edi — har bir yangi shartnoma o'sha odamga biriktirilardi. Endi
//     moderator /api/moderators dagi HAQIQIY ro'yxatdan tanlanadi
//     (hr_employees, turi: "moderator").

// Formada Qiymat faqat raqamlardan iborat SATR sifatida saqlanadi (MoneyInput
// shuni qaytaradi), saqlashda songa qaytariladi — bazadagi
// ContractPart.amount son bo'lib qoladi (contractPartsTotal shunga tayanadi).
type PartDraft = Omit<ContractPart, "amount"> & { amount: string };

function nextPartId(parts: PartDraft[]): number {
  return parts.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

export default function FinanceContractDrawer({
  contract,
  students,
  studentsLoading,
  onClose,
  onSaved,
}: {
  contract?: FinanceContract;
  students: StudentRow[];
  /**
   * `students` propi hali /api/pupils dan kelayotgan bo'lsa `true`.
   *
   * Ro'yxat SAHIFADAN uzatiladi, shuning uchun drawer o'zi bilolmaydi:
   * bo'sh massiv "o'quvchi yo'q" degani emas, "hali kelmagan" degani ham
   * bo'lishi mumkin. Bu bayroqsiz ro'yxat ochilganda "Topilmadi" yozilardi.
   */
  studentsLoading?: boolean;
  onClose: () => void;
  onSaved: (c: FinanceContract) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose, "drawer");
  const { showSuccess, showError } = useToast();
  const { moderators, loading: moderatorsLoading } = useModerators();

  // Tanlash ro'yxatida ism va telefon — bir xil ismli o'quvchilarni ajratish
  // uchun (telefonsiz o'quvchida faqat ism turadi).
  const optionOf = (s: StudentRow) => (s.phone ? `${s.name} — ${s.phone}` : s.name);
  const studentOptions = useMemo(() => students.map(optionOf), [students]);
  // Tahrirlashda tanlangan o'quvchi ro'yxatdan HISOBLANADI, state'ga nusxa
  // qilinmaydi: `students` propi birinchi renderda bo'sh bo'lib, keyin
  // /api/pupils dan kelgach ro'yxat to'ladi — nusxa qilinganda maydon bo'sh
  // qolib ketardi (effekt bilan sinxronlash esa ortiqcha render zanjiri).
  const savedStudentOption = useMemo(
    () => (contract
      ? studentOptions.find((opt) => opt === contract.studentName || opt.startsWith(`${contract.studentName} —`)) ?? ""
      : ""),
    [contract, studentOptions],
  );
  // `null` — foydalanuvchi hali o'zi tanlamagan (saqlangani ko'rinadi).
  const [picked, setPicked] = useState<string | null>(null);
  const studentOption = picked ?? savedStudentOption;
  const setStudentOption = setPicked;
  const [moderatorId, setModeratorId] = useState(contract?.moderatorId ? String(contract.moderatorId) : "");
  const [comment, setComment] = useState(contract?.comment ?? "");
  const [parts, setParts] = useState<PartDraft[]>(
    contract?.parts.map((p) => ({ ...p, amount: p.amount ? String(p.amount) : "" })) ??
      [{ id: 1, amount: "", date: null, comment: "" }],
  );
  const [saving, setSaving] = useState(false);

  function updatePart(id: number, patch: Partial<PartDraft>) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addPart() {
    setParts((prev) => [...prev, { id: nextPartId(prev), amount: "", date: null, comment: "" }]);
  }
  function removePart(id: number) {
    setParts((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  async function save() {
    const student = students.find((s) => optionOf(s) === studentOption);
    if (!student) {
      showError(t("O'quvchini tanlang"));
      return;
    }
    const moderator = moderators.find((m) => m.id === Number(moderatorId));
    if (!moderator) {
      showError(t("Moderatorni tanlang"));
      return;
    }
    setSaving(true);
    const url = contract ? `/api/finance-contracts/${contract.id}` : "/api/finance-contracts";
    const method = contract ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // `studentOrderId` nomi eski (Order.id davridan qolgan), qiymati
          // esa endi HAQIQIY pupils.id — jadvaldagi profil havolasi shunga
          // tayanadi.
          studentOrderId: student.id,
          studentName: student.name,
          moderatorId: moderator.id,
          moderatorName: moderator.name,
          comment,
          parts: parts.map((p) => ({ ...p, amount: Number(p.amount) || 0 })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.contract as FinanceContract);
      showSuccess(contract ? t("Shartnoma yangilandi") : t("Shartnoma qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare variant="drawer" size="sm" zIndex={110}>
        <div className="flex items-center gap-3 px-5 py-4 bg-primary text-white">
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-[16px] font-semibold flex-1">{contract ? t("Shartnomani tahrirlash") : t("Shartnoma yaratish")}</h3>
          <button onClick={modal.close} className="h-8 w-8 rounded-md hover:bg-white/15 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <StudentSearchSelect
            label={t("O'quvchi")}
            required
            value={studentOption}
            onChange={setStudentOption}
            options={studentOptions}
            placeholder={t("O'quvchini tanlang")}
            loading={studentsLoading}
          />

          <div>
            <label className="block text-[13px] font-medium mb-1.5">
              {t("Moderator")}<span className="text-red-500"> *</span>
            </label>
            <Select value={moderatorId} onChange={(v) => setModeratorId(v)} options={moderators.map((m) => ({ value: String(m.id), label: m.name }))} placeholder={selectPlaceholder(moderatorsLoading, moderators.length, "Moderator qo'shilmagan")} clearable disabled={moderatorsLoading} />
          </div>

          <div>
            <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              type="text"
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="space-y-4">
            {parts.map((part, i) => (
              <div key={part.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted-foreground">Shartnoma qismi {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePart(part.id)}
                    disabled={parts.length <= 1}
                    className="h-7 w-7 rounded-md hover:bg-rose-500/10 hover:text-rose-600 inline-flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                    title={t("O'chirish")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">{t("Qiymat")}</label>
                  <MoneyInput
                    value={part.amount}
                    onChange={(v) => updatePart(part.id, { amount: v })}
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">{t("Shartnoma sanasi")}</label>
                  <DatePicker
                    value={part.date ? new Date(part.date) : null}
                    onChange={(d) => {
                      const p2 = (n: number) => String(n).padStart(2, "0");
                      updatePart(part.id, { date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` });
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5">{t("Izoh")}</label>
                  <input
                    value={part.comment}
                    onChange={(e) => updatePart(part.id, { comment: e.target.value })}
                    type="text"
                    className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPart}
            className="w-full h-9 rounded-lg border border-dashed border-primary/50 text-primary text-sm font-medium hover:bg-primary/5"
          >
            {t("+ Shartnoma qismini qo'shish")}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={modal.close} disabled={saving} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60">
            {t("Orqaga")}
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </Modal>
  );
}
