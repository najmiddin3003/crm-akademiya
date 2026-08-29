"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { todayStart, type Task } from "@/lib/tasksData";
import { uzDayKey } from "@/lib/uzTime";

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
  const tomorrow = new Date(todayStart().getTime() + 86400000);
  const existing = new Date(task.date);
  const [date, setDate] = useState(toDateInputValue(tomorrow));
  const [time, setTime] = useState(`${pad(existing.getHours() || 9)}:${pad(existing.getMinutes() || 0)}`);
  const [error, setError] = useState<string | null>(null);
  useEscapeClose(onClose);

  const handleConfirm = () => {
    if (!date) {
      setError("Sanani tanlang");
      return;
    }
    const newDate = new Date(`${date}T${time || "09:00"}:00`);
    // Toshkent taqvimidagi kunlar taqqoslanadi — `todayStart()` siljitilgan
    // sana qaytaradi va uni bu yerdagi lokal sana bilan solishtirish
    // 5 soatlik xato berardi (lib/uzTime.ts).
    if (uzDayKey(newDate) <= uzDayKey()) {
      setError("Iltimos, bugundan keyingi sanani tanlang!");
      return;
    }
    onConfirm(newDate.toISOString());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Topshiriqni ko&apos;chirish</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{task.student}</strong> uchun yangi sanani tanlang. Sana bugundan kelajakda bo&apos;lishi kerak.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sana</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setError(null); }}
              className={`h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "ring-2 ring-red-400 border-red-400" : "border-border"}`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vaqt</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600">⚠ {error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" onClick={handleConfirm}>Ko&apos;chirish</Button>
        </div>
      </div>
    </div>
  );
}
