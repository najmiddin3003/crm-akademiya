"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Pupil, PupilListItem } from "@/lib/pupilsData";
import { loadPupilsCached } from "@/hooks/useStudents";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import Modal, { useModalClose } from "@/components/ui/Modal";
import { uzDateIso } from "@/lib/uzTime";
import { useT } from "@/components/shared/Language";

// "O'quvchini tanlang" modali (skrinshot 5). Serverdagi o'quvchilar
// (/api/pupils) ro'yxatidan birini tanlab, guruhga qo'shadi
// (POST /api/groups/:id/students). Allaqachon guruhda bo'lganlar ro'yxatda
// ko'rsatilmaydi.
export interface AddStudentModalProps {
  groupId: number;
  existingIds: number[];
  onClose: () => void;
  onAdded: (pupil: Pupil) => void;
}

export default function AddStudentModal({ groupId, existingIds, onClose, onAdded }: AddStudentModalProps) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [pupils, setPupils] = useState<PupilListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  // Darslar qaysi kundan sanaladi (Qarzdorlar hisoboti) — sukut bugun;
  // o'quvchi avvalroq qatnay boshlagan bo'lsa orqaga suriladi.
  const [joinedAt, setJoinedAt] = useState(() => uzDateIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Bu yerda faqat ism/telefon ko'rsatiladi -> yengil ro'yxat, ustiga u
    // umumiy keshdan keladi (hooks/useStudents.ts).
    loadPupilsCached(true)
      .then((list) => { if (!cancelled) setPupils(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const available = useMemo(() => pupils.filter((p) => !existingIds.includes(p.id)), [pupils, existingIds]);

  async function save() {
    const pupilId = Number(selected);
    if (!pupilId) {
      showError(t("O'quvchini tanlang"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId, joinedAt: joinedAt || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Qo'shilmadi"));
        setSaving(false);
        return;
      }
      onAdded(data.student as Pupil);
      showSuccess(t("O'quvchi guruhga qo'shildi"));
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2 text-center">
          <h3 className="text-[17px] font-bold tracking-tight">{t("O'quvchini tanlang")}</h3>
        </div>
        <div className="px-6 py-4">
          <label className="block text-[13px] font-medium mb-1.5">{t("O'quvchini tanlang")}</label>
          <Select value={selected} onChange={(v) => setSelected(v)} options={available.map((p) => ({ value: String(p.id), label: `${p.firstName} ${p.lastName} ${p.phone ? ` — ${p.phone}` : ""}` }))} placeholder={loading ? "Yuklanmoqda…" : available.length ? t("Tanlang") : t("O'quvchilar yo'q")} clearable size="lg" disabled={loading} />
          {!loading && available.length === 0 && (
            <p className="mt-2 text-[12px] text-muted-foreground">{t("Serverda qo'shiladigan o'quvchi yo'q. Avval Lidlar → \"O'quvchi qo'shish\" orqali o'quvchi qo'shing.")}</p>
          )}
          <label className="block text-[13px] font-medium mt-4 mb-1.5">{t("Darslar boshlangan sana")}</label>
          <DateField value={joinedAt} onChange={setJoinedAt} variant="form" />
          <p className="mt-1.5 text-[12px] text-muted-foreground">{t("Qarz shu kundan, guruh jadvali bo'yicha hisoblanadi.")}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={save} disabled={saving || loading} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? t("Saqlanmoqda…") : t("Saqlash")}</button>
        </div>
      </Modal>
  );
}
