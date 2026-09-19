"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import TaskTypeIcon from "@/components/tasks/TaskTypeIcon";
import {
  DEFAULT_TASK_TYPE_COLOR,
  DEFAULT_TASK_TYPE_ICON,
  TASK_TYPE_COLORS,
  TASK_TYPE_ICON_KEYS,
  type TaskType,
} from "@/lib/taskTypes";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// "Yangi tur" / "Turni tahrirlash" oynasi — referensdagi (akademiya.edutizim.uz)
// kabi: tepada jonli KO'RINISH kartasi, so'ng nomi, rang paletkasi va belgilar
// to'ri. Qo'shish va tahrirlash bir xil oyna (farqi — sarlavha va tugma matni).

export interface TaskTypeModalProps {
  /** null bo'lsa — yangi tur. */
  type: TaskType | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (values: { name: string; color: string; icon: string }) => void;
}

export default function TaskTypeModal({ type, saving, error, onClose, onSave }: TaskTypeModalProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [name, setName] = useState(type?.name ?? "");
  const [color, setColor] = useState(type?.color ?? DEFAULT_TASK_TYPE_COLOR);
  const [icon, setIcon] = useState(type?.icon ?? DEFAULT_TASK_TYPE_ICON);
  const [nameError, setNameError] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    onSave({ name: name.trim(), color, icon });
  };

  return (
    <Modal onClose={onClose} controller={modal} bare zIndex={1200}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-lg font-semibold">{type ? t("Turni tahrirlash") : t("Yangi tur")}</h3>
          <button type="button" onClick={modal.close} title={t("Yopish (Esc)")} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {/* Jonli ko'rinish */}
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: color }}
            >
              <TaskTypeIcon icon={icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Ko'rinishi")}
              </span>
              <span className={`block truncate text-[15px] font-semibold ${name ? "" : "text-muted-foreground"}`}>
                {name || "Tur nomi..."}
              </span>
            </span>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Nomi")}
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
              placeholder={t("Masalan: Konsultatsiya")}
              className={`h-11 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                nameError ? "border-red-400 ring-2 ring-red-400" : "border-border"
              }`}
            />
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Rangi")}
            </span>
            <div className="grid grid-cols-9 gap-2">
              {TASK_TYPE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                    color === c ? "ring-2 ring-offset-2 ring-primary ring-offset-card" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Belgisi")}
            </span>
            <div className="grid grid-cols-8 gap-2">
              {TASK_TYPE_ICON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIcon(k)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    icon === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <TaskTypeIcon icon={k} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">⚠ {error}</div>}
          {nameError && <div className="text-sm text-red-600">{t("⚠ Tur nomini kiriting")}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4 shrink-0">
          <Button variant="outline" onClick={modal.close}>{t("Bekor qilish")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t("Saqlanmoqda...") : t("Saqlash")}
          </Button>
        </div>
      </Modal>
  );
}
