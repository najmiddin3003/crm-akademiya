"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useStaff } from "@/hooks/useStaff";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// "Mashg'ulot qo'shish" modali — Guruh tafsiloti > "Mashg'ulot qo'shish" tabi.
// Ko'rinishi AddTaskModal.tsx bilan bir xil (bir xil overlay, kartochka,
// input klasslari va pastdagi Orqaga/Saqlash tugmalari).
//
// Yordamchi o'qituvchilar ro'yxati QATTIQ YOZILMAGAN: u useStaff() orqali
// /api/hr-employees dan (arxivda bo'lmagan xodimlar) keladi. Aks holda
// mashg'ulotga tizimda umuman mavjud bo'lmagan odam biriktirilib qolardi.

// GroupLesson tipi shu yerda turadi, chunki uni faqat shu modal va
// GroupDetailPage bo'lishadi. Server tomondagi nusxasi —
// app/api/groups/[id]/lessons/route.ts ichida.
export interface GroupLesson {
  id: number;
  groupId: number;
  name: string;
  assistants: string[];
  /** "DD.MM.YYYY | HH:mm" */
  createdAt: string;
}

const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

export default function AddLessonModal({ groupId, onClose, onAdded }: { groupId: number; onClose: () => void; onAdded: (lesson: GroupLesson) => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const { names, loading: staffLoading } = useStaff();
  const [name, setName] = useState("");
  const [assistants, setAssistants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleAssistant = (person: string) => {
    setAssistants((prev) => (prev.includes(person) ? prev.filter((p) => p !== person) : [...prev, person]));
  };

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError(t("Mashg'ulot nomini kiriting"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, assistants }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Mashg'ulot qo'shilmadi"));
        setSaving(false);
        return;
      }
      onAdded(data.lesson as GroupLesson);
      showSuccess(t("Mashg'ulot qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <h3 className="text-[16px] font-semibold">{t("Mashg'ulot qo'shish")}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>{t("Mashg'ulot nomi")}<span className="text-rose-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>{t("Yordamchi o'qituvchilar")}</label>
            {/* Ko'p tanlovli ro'yxat. Balandlik inline style bilan berilgan —
                loyihaning tayyor CSS blobida `max-h-*` klasslari yo'q. */}
            <div className="rounded-lg border border-border overflow-y-auto" style={{ maxHeight: 200 }}>
              {staffLoading && <div className="px-3 py-3 text-[13px] text-muted-foreground">{t("yuklanmoqda…")}</div>}
              {!staffLoading && names.length === 0 && (
                <div className="px-3 py-3 text-[13px] text-muted-foreground">{t("Aktiv xodim topilmadi")}</div>
              )}
              {names.map((person) => (
                <label key={person} className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-secondary/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={assistants.includes(person)}
                    onChange={() => toggleAssistant(person)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{person}</span>
                </label>
              ))}
            </div>
            {assistants.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {assistants.map((person) => (
                  <span key={person} className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{person}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">{t("Orqaga")}</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? t("Saqlanmoqda…") : t("Saqlash")}</button>
        </div>
      </Modal>
  );
}
