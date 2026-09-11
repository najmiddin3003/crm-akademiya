"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DateField from "@/components/ui/DateField";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useModerators } from "@/hooks/useModerators";
import { useProfilePupil } from "@/hooks/useProfilePupil";
import { useTaskTypes } from "@/hooks/useTaskTypes";
import { KANBAN_STATES, formatTaskDate, type Task } from "@/lib/tasksData";
import Select from "@/components/ui/Select";
import TimeField from "@/components/ui/TimeField";
import Modal, { useModalClose } from "@/components/ui/Modal";

// O'quvchi profili → "Vazifa".
//
// ILGARI NIMA NOTO'G'RI EDI:
//   • "Topshiriq" oynasidagi "Saqlash" tugmasi FAQAT oynani yopardi —
//     formadan hech nima o'qilmasdi, hech qayerga yuborilmasdi. Yozilgan
//     topshiriq jimgina yo'qolardi.
//   • "Moderator" va "Topshiriq turi" tanlovlarida BIRORTA variant yo'q
//     edi (faqat bo'sh placeholder <option>).
//   • Pastdagi ro'yxat har doim "Eslatmalar yo'q" deb turardi, chunki
//     hech qanday so'rov yo'q edi.
//   • Yuqoridagi holat tanlovi (Jarayonda/Tugatilgan) hech narsani
//     filtrlamasdi.
//
// Endi hammasi HAQIQIY backend'ga ulangan:
//   • Ro'yxat va yaratish — /api/tasks (MongoDB `tasks`). Topshiriq shu
//     o'quvchiga biriktiriladi: `targetKind: "student"`, `student` esa
//     o'quvchining bazadagi to'liq ismi (lib/tasksData.ts).
//   • "Topshiriq turi" — /api/task-types (Topshiriqlar sahifasidagi
//     "⋮ → Topshiriq turi" oynasi boshqaradi).
//   • "Moderator" — /api/moderators (hr_employees, turi: "moderator");
//     u topshiriqning `staff` (mas'ul shaxs) maydoniga yoziladi.
//
// CHEKLOV: `Task.student` — id emas, ISM satri (sxema shunday). Shu bois
// bir xil ismli o'quvchilar bir-birining topshirig'ini ko'rishi mumkin.
// Yozuvga `pupilId` qo'shilsa, filtr shunga ko'chiriladi.

const STATUS_OPTIONS = [
  { key: "jarayonda", label: "Jarayonda" },
  { key: "tugatilgan", label: "Tugatilgan" },
];

function stateLabel(t: Task): string {
  return KANBAN_STATES.find((s) => s.key === t.state)?.label ?? t.state;
}

export default function VazifaTabContent({ pupilId: pupilIdProp }: { pupilId?: number }) {
  const { showSuccess, showError } = useToast();
  const { pupil, fullName, loading: pupilLoading } = useProfilePupil(pupilIdProp);
  const { types: taskTypes, loading: typesLoading } = useTaskTypes();
  const { names: moderatorNames, loading: moderatorsLoading } = useModerators();

  const [status, setStatus] = useState("jarayonda");
  const [statusOpen, setStatusOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const statusLabel = STATUS_OPTIONS.find((s) => s.key === status)?.label ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Oyna maydonlari — endi hammasi boshqariladigan (controlled).
  const [moderator, setModerator] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTasks(d.tasks as Task[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTasksLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Shu o'quvchining topshiriqlari + yuqoridagi holat filtri.
  // "Jarayonda" — tugallanmagan hammasi, "Tugatilgan" — `bajarilgan`.
  const mine = useMemo(() => {
    const key = fullName.trim().toLowerCase();
    if (!key) return [];
    return tasks
      .filter((t) => (t.student || "").trim().toLowerCase() === key)
      .filter((t) => (status === "tugatilgan" ? t.state === "bajarilgan" : t.state !== "bajarilgan"))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tasks, fullName, status]);

  const loading = pupilLoading || tasksLoading;
  // Majburiy maydonlar to'lmaguncha "Saqlash" yonmaydi (TaskModal bilan
  // bir xil qoida) — yarim to'ldirilgan yozuv bazaga tushmasin.
  const complete = Boolean(date && time && moderator && type);

  // useCallback — useEscapeClose effektining har renderda qayta
  // obuna bo'lishining oldini oladi (tab doim mount holatda turadi).
  const closeModal = useCallback(() => setModalOpen(false), []);
  const modal = useModalClose(closeModal, "drawer");

  const resetForm = () => {
    setModerator("");
    setType("");
    setDate("");
    setTime("");
    setNote("");
  };

  const save = async () => {
    if (!pupil) {
      showError("O'quvchi bazada topilmadi — topshiriq biriktirib bo'lmaydi");
      return;
    }
    if (!complete) return;
    setSaving(true);
    const payload: Omit<Task, "id"> = {
      student: fullName,
      targetKind: "student",
      date: `${date}T${time}:00`,
      description: note.trim() || type,
      staff: moderator,
      type,
      // Bu oynada muhimlik/takrorlanish maydonlari yo'q — bazadagi
      // standart qiymatlar qo'yiladi (Topshiriqlar sahifasida
      // o'zgartirilishi mumkin).
      priority: "orta",
      recurring: "none",
      state: "yangi",
    };
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      showError(res?.error || "Topshiriqni saqlab bo'lmadi");
      return;
    }
    setTasks((prev) => [...prev, res.task as Task]);
    // Yangi topshiriq "yangi" holatida — u "Jarayonda" ro'yxatida ko'rinadi.
    setStatus("jarayonda");
    resetForm();
    setModalOpen(false);
    showSuccess("Topshiriq qo'shildi");
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
      {!pupilLoading && !pupil && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-[13px]">
          Bu yozuv o&apos;quvchilar bazasida topilmadi — topshiriq biriktirib bo&apos;lmaydi.
        </div>
      )}

      <div className="text-center">
        <button
          type="button"
          disabled={!pupil}
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Eslatma qo&apos;shish
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setStatusOpen((v) => !v)}
          className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-secondary/30 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {statusLabel}
        </button>
        <svg
          onClick={() => setStatusOpen((v) => !v)}
          className="icon icon-sm absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer"
        >
          <use href="#i-chevron-down" />
        </svg>

        {statusOpen && (
          <div className="absolute left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStatus(s.key);
                  setStatusOpen(false);
                }}
                className="flex items-center justify-between w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/40"
              >
                <span className={s.key === status ? "text-primary font-medium" : ""}>{s.label}</span>
                {s.key === status && (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ro'yxat: javob kelmaguncha "yo'q" deb aytilmaydi. */}
      {loading ? (
        <div className="rounded-xl bg-secondary/20 border border-border">
          <SpinnerBlock />
        </div>
      ) : mine.length === 0 ? (
        <div className="rounded-xl bg-secondary/20 border border-border py-8 text-center text-[14px] text-muted-foreground">
          Eslatmalar yo&apos;q
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map((t) => (
            <div key={t.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[14px] font-semibold">{t.type || "Topshiriq"}</span>
                <span className="inline-flex items-center h-6 px-2.5 rounded-md bg-secondary/50 text-[12px] font-medium">
                  {stateLabel(t)}
                </span>
              </div>
              {t.description && <p className="mt-1.5 text-[13px] text-muted-foreground">{t.description}</p>}
              <div className="mt-2 flex items-center gap-4 flex-wrap text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <svg className="icon icon-xs"><use href="#i-calendar" /></svg>
                  {formatTaskDate(t.date)}
                </span>
                {/* Mas'ul shaxs yozuvda bo'lmasa "—" (0 yoki taxminiy ism emas). */}
                <span>Moderator: {t.staff || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal onClose={closeModal} controller={modal} bare variant="drawer" zIndex={50} panelClassName="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-[18px] font-bold tracking-tight">Topshiriq</h3>
              <button
                type="button"
                onClick={modal.close}
                className="h-8 w-8 rounded-md hover:bg-secondary/60 text-muted-foreground inline-flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-5 pb-4 space-y-3">
              <Select value={moderator} onChange={(v) => setModerator(v)} options={moderatorNames.map((m) => ({ value: m, label: m }))} placeholder="Moderator" clearable size="lg" />
              {/* Ro'yxat bo'sh bo'lsa sababi aytiladi — aks holda "Saqlash"
                  nega yonmayotgani tushunarsiz bo'lardi. */}
              {!moderatorsLoading && moderatorNames.length === 0 && (
                <p className="-mt-1 text-[12px] text-muted-foreground">
                  Moderatorlar yo&apos;q — Boshqaruv &rarr; Xodimlar bo&apos;limida qo&apos;shiladi.
                </p>
              )}
              <Select value={type} onChange={(v) => setType(v)} options={taskTypes.map((t) => ({ value: t.name, label: t.name }))} placeholder="Topshiriq turi" clearable size="lg" />
              {!typesLoading && taskTypes.length === 0 && (
                <p className="-mt-1 text-[12px] text-muted-foreground">
                  Topshiriq turlari yo&apos;q — Topshiriqlar sahifasidagi &quot;⋮ &rarr; Topshiriq turi&quot; oynasida qo&apos;shiladi.
                </p>
              )}
              {/* Sana — loyihaning o'z maydoni (DD/MM/YYYY niqobi + kalendar);
                  ilgari bu shunchaki niqobsiz matn input edi. */}
              <DateField value={date} onChange={setDate} variant="panel" placeholder="kk/oo/yyyy" />
              <div className="relative">
                <TimeField value={time} onChange={(v) => setTime(v)} variant="panel" />
                {time && (
                  <button
                    type="button"
                    onClick={() => setTime("")}
                    title="Tozalash"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Vazifani yozing..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button type="button" onClick={modal.close} className="inline-flex items-center h-10 px-5 text-sm font-medium text-foreground/70 hover:text-foreground">Orqaga</button>
              <button
                type="button"
                onClick={save}
                disabled={!complete || saving}
                className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </Modal>
      )}
    </div>
  );
}
