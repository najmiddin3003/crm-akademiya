"use client";

import { useState } from "react";
import StudentSearchSelect from "@/components/orders/StudentSearchSelect";
import { TASK_TEMPLATES } from "@/lib/tasksData";
import { useStudents } from "@/hooks/useStudents";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

export interface TaskTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (templateId: string, studentName: string) => void;
}

export default function TaskTemplatesModal({ open, onClose, onApply }: TaskTemplatesModalProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  // O'quvchilar bazadan (/api/pupils) — ilgari constants/index.js dagi
  // STUDENT_NAMES statik ro'yxati edi.
  // Faqat ismlar va telefon kerak — yengil rejim.
  //
  // Bu oyna endi TasksPage.tsx da `{templatesOpen && <TaskTemplatesModal…/>}`
  // bilan o'ralgan, ya'ni ochilmagan holatda bu hook UMUMAN ishga
  // tushmaydi — /tasks sahifasining har ochilishida 546 KB tortilishi
  // shu bilan to'xtaydi.
  const { names: studentNames, byName: studentByName, loading: studentsLoading } = useStudents({ light: true });
  if (!open) return null;

  const pendingTpl = TASK_TEMPLATES.find((tv) => tv.id === pendingId);

  return (
    <Modal onClose={onClose} controller={modal} bare size="lg" zIndex={200} panelClassName="p-5 space-y-3 overflow-y-auto">
        <h3 className="text-lg font-semibold">{t("Tayyor shablonlar")}</h3>

        {pendingTpl ? (
          <div className="space-y-3">
            <div className="text-sm">
              <strong>{pendingTpl.name}</strong>{" "}{t("shablonini qaysi o'quvchi uchun qo'llaymiz?")}
            </div>
            {/* Ilgari bu yerda BUTUN ro'yxat (6 765 ta) xom <button>
                sifatida, qidiruvsiz, id kamayish tartibida chizilardi —
                eng oxirgi qo'shilgan o'quvchi tepada, ikki yil oldingisi
                esa oynani oxirigacha aylantirmasdan topib bo'lmasdi.
                StudentSearchSelect qidiruvni, 50 qatorlik limitni va
                "Yana N ta" hisoblagichini tayyor beradi. */}
            <StudentSearchSelect
              label={t("O'quvchi")}
              value={studentName}
              onChange={setStudentName}
              options={studentNames}
              loading={studentsLoading}
              placeholder={t("O'quvchini qidirish")}
              subtitleOf={(n) => {
                const phone = studentByName.get(n.trim().toLowerCase())?.phone;
                return phone ? `+998 ${phone}` : "";
              }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingId(null)} className="inline-flex items-center h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
                {t("Orqaga")}
              </button>
              <button
                onClick={() => {
                  if (!studentName.trim()) return;
                  onApply(pendingTpl.id, studentName.trim());
                  setPendingId(null);
                  setStudentName("");
                }}
                className="inline-flex items-center h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                {t("Qo'llash")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {TASK_TEMPLATES.map((tpl) => (
              <div key={tpl.id} className="template-card" onClick={() => setPendingId(tpl.id)}>
                <div className="template-card-title">
                  <div className="template-card-icon" style={{ background: tpl.iconBg, color: tpl.iconColor }}>
                    <svg className="icon icon-sm"><use href={`#${tpl.icon}`} /></svg>
                  </div>
                  <span>{tpl.name}</span>
                  <span className="text-[11px] font-normal opacity-60 ml-auto">{tpl.items.length} ta task</span>
                </div>
                <div className="template-card-desc">{t(tpl.description)}</div>
                <div className="template-card-items">
                  {tpl.items.map((it, i) => (
                    <span key={i} className="template-item-chip">
                      {it.description.slice(0, 32)}{it.description.length > 32 ? "…" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
  );
}
