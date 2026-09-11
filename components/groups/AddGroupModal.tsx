"use client";

import { useState } from "react";
import { Archive, CircleCheck, Snowflake } from "lucide-react";
import Modal, { useModal } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import DateField from "@/components/ui/DateField";
import { useToast } from "@/components/ui/Toast";
import { useOfflineCourseList } from "@/hooks/useOfflineCourseList";
import { GROUP_FORMATS } from "@/constants/groups";
import type { Group } from "@/lib/groups";

// Yangi guruh qo'shish modali (crm-akademiya #group-add-modal, skrinshot 2).
// Saqlash → POST /api/groups.
//
// Kurslar bazadan (/api/offline-courses). "Ta'lim turi" esa ilgari
// GROUP_EDU_TYPES — ya'ni BOSQICHLAR ro'yxatini ("1-bosqich", "Kids 2")
// ko'rsatardi va o'sha qiymat guruhning ta'lim TURI sifatida saqlanardi.
// Tahrirlash modali xuddi shu maydonga Oflayn/Onlayn beradi — endi ikkalasi
// bir xil (GROUP_FORMATS).
//
// Maydonlar (11.09.2026): native <select>/<input type="date"> o'rniga
// qo'lda yasalgan ui/Select, ui/Segmented va ui/DateField. "Guruh holati"
// va "Ta'lim turi" — segment tugmalar: variant 2–3 ta, deyarli doim
// birinchisi tanlanadi, shuning uchun standart qiymat oldindan turadi va
// moderator hech narsa bosmasa ham to'g'ri chiqadi.

const STATUS_OPTIONS = [
  { value: "active", label: "Aktiv guruh", icon: CircleCheck },
  { value: "frozen", label: "Muzlatilgan", icon: Snowflake },
  { value: "archive", label: "Arxiv", icon: Archive },
];
const FORMAT_OPTIONS = GROUP_FORMATS.map((f) => ({ value: f, label: f }));

const inputCls = "w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

/** Footer tugmalari — modal konteksti ichida, yopish animatsiya bilan. */
function Actions({ saving, onSave }: { saving: boolean; onSave: (close: () => void) => void }) {
  const { close } = useModal();
  return (
    <>
      <button
        type="button"
        onClick={close}
        disabled={saving}
        className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
      >
        Orqaga
      </button>
      <button
        type="button"
        onClick={() => onSave(close)}
        disabled={saving}
        className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </>
  );
}

export default function AddGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (g: Group) => void }) {
  const { showSuccess, showError } = useToast();
  const { names: courseNames, loading: coursesLoading } = useOfflineCourseList();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [course, setCourse] = useState("");
  const [eduType, setEduType] = useState(GROUP_FORMATS[0]);
  const [telegram, setTelegram] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);

  async function save(close: () => void) {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(true);
      showError("Guruh nomini kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status, course, eduType, telegram: telegram.trim(), startDate, endDate }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Guruh qo'shilmadi");
        setSaving(false);
        return;
      }
      onCreated?.(data.group as Group);
      showSuccess(`Guruh qo'shildi — ${trimmed}`);
      close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Yangi guruh qo'shish"
      subtitle={<><span className="text-red-500">*</span> Zarurligini bildiradi</>}
      locked={saving}
      footer={<Actions saving={saving} onSave={save} />}
    >
      <div>
        <label className={labelCls}>Guruh nomi<span className="text-red-500">*</span></label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false); }}
          type="text"
          autoFocus
          className={`${inputCls} ${nameError ? "border-red-400 ring-2 ring-red-400/60" : ""}`}
        />
      </div>
      <div>
        <label className={labelCls}>Guruh holati<span className="text-red-500">*</span></label>
        <Segmented value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      </div>
      <Select
        label="Kurs"
        required
        value={course}
        onChange={setCourse}
        options={courseNames.map((c) => ({ value: c, label: c }))}
        loading={coursesLoading}
        placeholder="Kursni tanlang"
        searchPlaceholder="Kursni qidirish"
        emptyText="Kurslar ro'yxati bo'sh — avval Oflayn kurslar bo'limida kurs oching"
      />
      <div>
        <label className={labelCls}>Ta&apos;lim turi<span className="text-red-500">*</span></label>
        <Segmented value={eduType} onChange={setEduType} options={FORMAT_OPTIONS} />
      </div>
      <div>
        <label className={labelCls}>Telegram guruh havolasi</label>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} type="text" placeholder="https://t.me/..." className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Boshlanish sanasi</label>
          <DateField value={startDate} onChange={setStartDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>
        <div>
          <label className={labelCls}>Bitkazish sanasi</label>
          <DateField value={endDate} onChange={setEndDate} variant="form" placeholder="kk/oo/yyyy" />
        </div>
      </div>
    </Modal>
  );
}
