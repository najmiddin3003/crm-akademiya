"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useGroups } from "@/hooks/useGroups";
import { LOADING_TEXT, selectPlaceholder } from "@/lib/selectPlaceholder";
import type { BlockTestExam } from "@/lib/blockTestExams";
import type { BlockTestType } from "@/lib/blockTestTypes";
import type { HrEmployee } from "@/lib/hrEmployees";
import Select from "@/components/ui/Select";
import DateField from "@/components/ui/DateField";
import TimeField from "@/components/ui/TimeField";
import Modal, { useModalClose } from "@/components/ui/Modal";

// "Blok test qo'shish" / tahrirlash modali (Blok test → Blok testlar, referens
// akademiya.edutizim.uz/block-test/exams). `exam` berilsa — tahrirlash
// (PATCH /api/block-test-exams/:id), aks holda qo'shish (POST).
const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";


export default function BlockTestExamModal({
  exam,
  onClose,
  onSaved,
}: {
  exam?: BlockTestExam;
  onClose: () => void;
  onSaved: (exam: BlockTestExam) => void;
}) {
  const modal = useModalClose(onClose);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(exam?.name || "");
  const [typeId, setTypeId] = useState(exam?.typeId ? String(exam.typeId) : "");
  const [date, setDate] = useState(exam?.date || "");
  const [startTime, setStartTime] = useState(exam?.startTime || "");
  const [durationMinutes, setDurationMinutes] = useState(exam ? String(exam.durationMinutes) : "0");
  const [groupIds, setGroupIds] = useState<number[]>(exam?.groupIds || []);
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState(exam?.responsibleEmployeeId ? String(exam.responsibleEmployeeId) : "");
  const [comment, setComment] = useState(exam?.comment || "");
  const [saving, setSaving] = useState(false);

  const [types, setTypes] = useState<BlockTestType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  // Guruhlar xom `fetch` dan hook'ga o'tkazildi: manba ham, ajratilgan
  // maydon ham AYNAN oldingidek (/api/groups → `d.groups`, `ok` bo'lmasa
  // ro'yxat o'zgarmaydi), ustiga yuklanish holati tayyor keladi va bir
  // sahifadagi boshqa ro'yxatlar bilan so'rov dedup bo'ladi
  // (hooks/useSharedList.ts).
  const { groups, loading: groupsLoading } = useGroups();
  const [groupsOpen, setGroupsOpen] = useState(false);
  const groupsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ikki so'rov ikki xil tanlovni to'ldiradi — shuning uchun `Promise.all`
    // emas: biri kelganda o'sha tanlov darrov ochiladi, ikkinchisini
    // kutib turmaydi.
    let cancelled = false;
    fetch("/api/block-test-types")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTypes(d.types); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTypesLoading(false); });
    fetch("/api/hr-employees")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setEmployees(d.employees); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmployeesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!groupsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (groupsRef.current && !groupsRef.current.contains(e.target as Node)) setGroupsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [groupsOpen]);

  function toggleGroup(id: number) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Nomini kiriting");
      return;
    }
    setSaving(true);
    const payload = {
      name: trimmed,
      typeId: typeId ? Number(typeId) : null,
      date,
      startTime,
      durationMinutes,
      groupIds,
      responsibleEmployeeId: responsibleEmployeeId ? Number(responsibleEmployeeId) : null,
      comment: comment.trim(),
    };
    const url = exam ? `/api/block-test-exams/${exam.id}` : "/api/block-test-exams";
    const method = exam ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        setSaving(false);
        return;
      }
      onSaved(data.exam as BlockTestExam);
      showSuccess(exam ? "Blok test yangilandi" : "Blok test qo'shildi");
      modal.close();
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} controller={modal} bare>
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <h3 className="text-[16px] font-semibold">{exam ? "Blok testni tahrirlash" : "Blok test qo'shish"}</h3>
        </div>

        <div className="px-6 py-2 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className={labelCls}>Nomi</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Nomi" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tur</label>
            <Select value={typeId} onChange={(v) => setTypeId(v)} options={types.map((t) => ({ value: String(t.id), label: t.name }))} placeholder={selectPlaceholder(typesLoading, types.length, "Tur qo'shilmagan")} clearable size="lg" disabled={typesLoading} />
          </div>
          <div>
            <label className={labelCls}>Sana</label>
            <DateField value={date} onChange={(v) => setDate(v)} variant="panel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Boshlanish vaqti</label>
              <TimeField value={startTime} onChange={(v) => setStartTime(v)} variant="panel" />
            </div>
            <div>
              <label className={labelCls}>Davomiyligi (daqiqa)</label>
              <input value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} type="number" min="0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Guruhlar</label>
            <div className="relative" ref={groupsRef}>
              <button
                type="button"
                onClick={() => setGroupsOpen((o) => !o)}
                className="w-full h-11 rounded-lg border border-border bg-card px-3 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <span className={groupIds.length ? "" : "text-muted-foreground"}>
                  {groupIds.length
                    ? `${groupIds.length} ta guruh tanlandi`
                    : groupsLoading ? LOADING_TEXT : "Tanlang"}
                </span>
                <svg className="icon icon-xs text-muted-foreground"><use href="#i-chevron-down" /></svg>
              </button>
              {groupsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-xl p-1">
                  {/* Yuklanish DOIM bo'sh-holatdan ustun: guruhlar kelayotgan
                      paytda "Guruh topilmadi" YOLG'ON bo'lardi va foydalanuvchi
                      guruh yo'q deb o'ylab modalni yopardi. */}
                  {groupsLoading ? (
                    <SpinnerBlock size={22} />
                  ) : groups.length === 0 ? (
                    <div className="px-2.5 py-2 text-sm text-muted-foreground">Guruh topilmadi</div>
                  ) : (
                    groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-secondary text-sm cursor-pointer">
                        <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="rounded border-border" />
                        <span>{g.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Mas&apos;ul xodim</label>
            <Select value={responsibleEmployeeId} onChange={(v) => setResponsibleEmployeeId(v)} options={employees.map((e) => ({ value: String(e.id), label: e.name }))} placeholder={selectPlaceholder(employeesLoading, employees.length, "Xodim qo'shilmagan")} clearable size="lg" disabled={employeesLoading} />
          </div>
          <div>
            <label className={labelCls}>Izoh</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={modal.close} className="inline-flex items-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
            Bekor qilish
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </Modal>
  );
}
