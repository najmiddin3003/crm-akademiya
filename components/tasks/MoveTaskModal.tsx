"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { todayStart, type Task } from "@/lib/tasksData";
import { uzDayKey } from "@/lib/uzTime";
import DateField from "@/components/ui/DateField";
import TimeField from "@/components/ui/TimeField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Ported from crm-akademiya/src/app.js openMoveTaskModal()/confirmMoveTask() (~line 3676).
// Shown when a task card is dropped onto the "Keyinchalik keladigan" (upcoming)
// column in the Vaqt view — the target date isn't guessable like it is for
// today/overdue, so the user picks one (must be strictly after today).

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface MoveTaskModalProps {
  task: Task;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
}

export default function MoveTaskModal({ task, onClose, onConfirm }: MoveTaskModalProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const tomorrow = new Date(todayStart().getTime() + 86400000);
  const existing = new Date(task.date);
  const [date, setDate] = useState(toDateInputValue(tomorrow));
  const [time, setTime] = useState(`${pad(existing.getHours() || 9)}:${pad(existing.getMinutes() || 0)}`);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!date) {
      setError(t("Sanani tanlang"));
      return;
    }
    const newDate = new Date(`${date}T${time || "09:00"}:00`);
    // Toshkent taqvimidagi kunlar taqqoslanadi — `todayStart()` siljitilgan
    // sana qaytaradi va uni bu yerdagi lokal sana bilan solishtirish
    // 5 soatlik xato berardi (lib/uzTime.ts).
    if (uzDayKey(newDate) <= uzDayKey()) {
      setError(t("Iltimos, bugundan keyingi sanani tanlang!"));
      return;
    }
    onConfirm(newDate.toISOString());
  };

  return (
    <Modal onClose={onClose} controller={modal} bare size="sm" zIndex={200} panelClassName="p-5 space-y-4">
        <h3 className="text-lg font-semibold">{t("Topshiriqni ko'chirish")}</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{task.student}</strong>{" "}{t("uchun yangi sanani tanlang. Sana bugundan kelajakda bo'lishi kerak.")}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Sana")}</label>
            <DateField value={date} onChange={(v) => { setDate(v); setError(null); }} error={!!error} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("Vaqt")}</label>
            <TimeField value={time} onChange={(v) => setTime(v)} />
          </div>
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={modal.close}>{t("Bekor qilish")}</Button>
          <Button variant="primary" onClick={handleConfirm}>{t("Ko'chirish")}</Button>
        </div>
      </Modal>
  );
}
