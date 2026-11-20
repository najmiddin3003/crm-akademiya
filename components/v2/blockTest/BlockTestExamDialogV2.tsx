"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { useModalClose } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2Picker from "@/components/v2/form/V2Picker";
import V2TimeField, { isTime } from "@/components/v2/form/V2TimeField";
import { Field, FieldHint, TextInput, fieldCls } from "@/components/v2/form/fields";
import { IsoDateField } from "@/components/v2/students/lists/listKit";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { timeLabel } from "@/components/v2/ui/groupStatus";
import { LOADING_TEXT, selectPlaceholder } from "@/lib/selectPlaceholder";
import type { BlockTestExam } from "@/lib/blockTestExams";
import type { BlockTestType } from "@/lib/blockTestTypes";
import type { Group } from "@/lib/groups";
import type { HrEmployee } from "@/lib/hrEmployees";

// YANGI VERSIYA — «BLOK TEST QO'SHISH» / «BLOK TESTNI TAHRIRLASH» OYNASI (Blok test → Blok testlar, 54-qism, rasmsiz,
// 20.11.2026). Mantiq AYNAN eski components/blockTest/BlockTestExamModal.tsx dan:
//   • POST /api/block-test-exams (qo'shish) yoki PATCH /api/block-test-exams/:id (tahrirlash);
//   • so'rov tanasi { name (trim), typeId (son | null), date ("YYYY-MM-DD" | ""), startTime ("HH:MM" | ""),
//     durationMinutes (yozilgan matn), groupIds, responsibleEmployeeId (son | null), comment (trim) };
//   • tekshiruv — nomi («Nomini kiriting»; eskisida toast, bu yerda maydon ostida). Qo'shimcha: vaqt yarim yozilgan
//     bo'lsa saqlatmaydi (eski TimeField noto'g'ri vaqt bermasdi).
// Ro'yxatlar (turlar, guruhlar, xodimlar) — sahifa yuklagan o'sha /api/block-test-types, /api/groups,
// /api/hr-employees (eski oyna ularni qayta so'rardi).

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 5);

export default function BlockTestExamDialogV2({
  exam,
  types,
  groups,
  employees,
  listsLoading,
  onClose,
  onSaved,
}: {
  exam?: BlockTestExam;
  types: BlockTestType[];
  groups: Group[];
  employees: HrEmployee[];
  listsLoading: boolean;
  onClose: () => void;
  onSaved: (exam: BlockTestExam) => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const modal = useModalClose(onClose, "center");

  const initial = useMemo(
    () => ({
      name: exam?.name || "",
      typeId: exam?.typeId ? String(exam.typeId) : "",
      date: exam?.date || "",
      startTime: exam?.startTime || "",
      duration: exam ? String(exam.durationMinutes) : "0",
      groupIds: exam?.groupIds || [],
      responsible: exam?.responsibleEmployeeId ? String(exam.responsibleEmployeeId) : "",
      comment: exam?.comment || "",
    }),
    [exam],
  );
  const [name, setName] = useState(initial.name);
  const [typeId, setTypeId] = useState(initial.typeId);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [duration, setDuration] = useState(initial.duration);
  const [groupIds, setGroupIds] = useState<number[]>(initial.groupIds);
  const [responsible, setResponsible] = useState(initial.responsible);
  const [comment, setComment] = useState(initial.comment);
  const [errors, setErrors] = useState<{ name?: string; time?: string }>({});
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== initial.name ||
    typeId !== initial.typeId ||
    date !== initial.date ||
    startTime !== initial.startTime ||
    duration !== initial.duration ||
    responsible !== initial.responsible ||
    comment !== initial.comment ||
    groupIds.join(",") !== initial.groupIds.join(",");

  const typeOptions = useMemo(
    () =>
      types.map((x) => ({
        value: String(x.id),
        label: x.name,
        sublabel: [x.code, x.durationMinutes ? t("{n} daqiqa", { n: x.durationMinutes }) : ""].filter(Boolean).join(" · "),
        hint: x.active ? undefined : t("nofaol"),
      })),
    [types, t],
  );
  const employeeOptions = useMemo(() => employees.map((e) => ({ value: String(e.id), label: e.name })), [employees]);
  const pickedType = typeId ? types.find((x) => String(x.id) === typeId) : undefined;

  async function save() {
    if (saving) return;
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = t("Nomini kiriting");
    if (startTime && !isTime(startTime)) next.time = t("Vaqtni to'g'ri kiriting (masalan 09:30)");
    setErrors(next);
    if (next.name || next.time) return;
    setSaving(true);
    // Eski oyna bilan bir xil tana.
    const payload = {
      name: trimmed,
      typeId: typeId ? Number(typeId) : null,
      date,
      startTime,
      durationMinutes: duration,
      groupIds,
      responsibleEmployeeId: responsible ? Number(responsible) : null,
      comment: comment.trim(),
    };
    const url = exam ? `/api/block-test-exams/${exam.id}` : "/api/block-test-exams";
    const method = exam ? "PATCH" : "POST";
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Saqlanmadi"));
        setSaving(false);
        return;
      }
      onSaved(data.exam as BlockTestExam);
      showSuccess(exam ? t("Blok test yangilandi") : t("Blok test qo'shildi"));
      setSaving(false);
      modal.close();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setSaving(false);
    }
  }

  return (
    <V2Dialog
      title={exam ? t("Blok testni tahrirlash") : t("Blok test qo'shish")}
      subtitle={exam ? exam.createdAt : t("Sana, vaqt, guruhlar va mas'ul xodim")}
      onClose={onClose}
      controller={modal}
      dirty={dirty}
      saving={saving}
      onSubmit={() => void save()}
      width={600}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={`${primaryBtn} disabled:opacity-60`}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")} htmlFor="bte-name" error={errors.name}>
          <TextInput
            id="bte-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
            }}
            placeholder={t("Nomi")}
            state={errors.name ? "error" : "default"}
          />
        </Field>

        <Field label={t("Tur")} hint={pickedType && pickedType.durationMinutes ? t("Tur davomiyligi — {n} daqiqa", { n: pickedType.durationMinutes }) : undefined}>
          <V2Picker
            value={typeId}
            onChange={setTypeId}
            options={typeOptions}
            label={t("Tur")}
            placeholder={t(selectPlaceholder(listsLoading, types.length, "Tur qo'shilmagan"))}
            loading={listsLoading}
            clearable
          />
        </Field>

        <div className="grid gap-4 min-[40rem]:grid-cols-[minmax(0,1fr)_128px_148px]">
          <Field label={t("Sana")}>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <IsoDateField value={date} onChange={setDate} />
              </div>
              {date && (
                <button
                  type="button"
                  onClick={() => setDate("")}
                  title={t("Tozalash")}
                  aria-label={t("Sanani tozalash")}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden />
                </button>
              )}
            </div>
          </Field>
          <Field label={t("Boshlanish vaqti")} htmlFor="bte-time" error={errors.time}>
            <V2TimeField
              id="bte-time"
              value={startTime}
              onChange={(v) => {
                setStartTime(v);
                if (errors.time) setErrors((x) => ({ ...x, time: undefined }));
              }}
              state={errors.time ? "error" : "default"}
              placeholder="09:00"
            />
          </Field>
          <Field label={t("Davomiyligi")} htmlFor="bte-duration">
            <div className="relative">
              <TextInput id="bte-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(digits(e.target.value))} className="pr-16 tabular-nums" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-v2-small text-v2-text-3">{t("daqiqa")}</span>
            </div>
          </Field>
        </div>

        <Field label={t("Guruhlar")}>
          <GroupsPicker groups={groups} value={groupIds} onChange={setGroupIds} loading={listsLoading} />
        </Field>

        <Field label={t("Mas'ul xodim")}>
          <V2Picker
            value={responsible}
            onChange={setResponsible}
            options={employeeOptions}
            label={t("Mas'ul xodim")}
            placeholder={t(selectPlaceholder(listsLoading, employees.length, "Xodim qo'shilmagan"))}
            loading={listsLoading}
            searchPlaceholder={t("Ism bo'yicha qidirish")}
            clearable
          />
        </Field>

        <Field label={t("Izoh")} optional htmlFor="bte-comment">
          <textarea id="bte-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={fieldCls("default", "h-auto! py-2 leading-5")} />
        </Field>
      </div>
    </V2Dialog>
  );
}

/**
 * Guruhlar — bir nechtasini tanlash: maydonda tanlanganlar tabletka (× bilan), bosilsa ro'yxat — qidiruv (nomi, kurs,
 * o'qituvchi), katakchalar, «N ta tanlandi» va «Tozalash». Eski oynadagi ro'yxat (/api/groups) o'sha.
 */
function GroupsPicker({ groups, value, onChange, loading }: { groups: Group[]; value: number[]; onChange: (ids: number[]) => void; loading: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const selected = new Set(value);
  const query = q.trim().toLowerCase();
  const list = query ? groups.filter((g) => [g.name, g.course, g.level, g.teacher].join(" ").toLowerCase().includes(query)) : groups;

  const toggle = (id: number) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <>
      <div
        ref={boxRef}
        className={fieldCls(
          "default",
          `flex h-auto! min-h-10 flex-wrap items-center gap-1.5 px-1.5! py-1.5 focus-within:border-v2-brand focus-within:shadow-v2-focus ${open ? "border-v2-brand shadow-v2-focus" : ""}`,
        )}
      >
        {value.map((id) => {
          const g = byId.get(id);
          const label = g ? g.name : `#${id}`;
          return (
            <span key={id} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-v2-full border border-v2-border bg-v2-surface-2 pl-2 pr-1 text-v2-small font-medium text-v2-text">
              {g && <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />}
              <span className="truncate">{label}</span>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={t("{name} — olib tashlash", { name: label })}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-v2-text-3 hover:bg-v2-hover hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          disabled={loading}
          className="inline-flex h-7 min-w-[120px] flex-1 items-center justify-between gap-1 rounded-v2-sm px-1.5 text-left text-v2-body text-v2-text-3 transition-colors hover:text-v2-text focus-visible:outline-none disabled:cursor-wait"
        >
          <span className="truncate">{loading ? t(LOADING_TEXT) : value.length ? t("Guruh qo'shish") : t("Tanlang")}</span>
          <ChevronDown className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {value.length > 0 && <FieldHint>{t("{n} ta guruh tanlandi", { n: value.length })}</FieldHint>}
      <FloatingPanel open={open} anchorRef={boxRef} onClose={() => setOpen(false)} maxHeight={340} role="listbox" ariaLabel={t("Guruhlar")}>
        <div data-enter-ignore className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-v2-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder={t("Guruh, kurs yoki o'qituvchi")}
                aria-label={t("Qidirish")}
                className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface-2! pl-8 pr-2 text-v2-small text-v2-text placeholder:text-v2-text-3 focus:border-v2-brand focus:outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {groups.length === 0 ? (
              <div className="px-3 py-6 text-center text-v2-small text-v2-text-3">{t("Guruh topilmadi")}</div>
            ) : list.length === 0 ? (
              <div className="px-3 py-6 text-center text-v2-small text-v2-text-3">{t("Mos guruh topilmadi")}</div>
            ) : (
              list.map((g) => {
                const on = selected.has(g.id);
                return (
                  <label key={g.id} className={`flex cursor-pointer items-center gap-2.5 rounded-v2-md px-2.5 py-2 text-v2-small ${on ? "bg-v2-brand-bg" : "hover:bg-v2-surface-2"}`}>
                    <V2Checkbox checked={on} onChange={() => toggle(g.id)} label={g.name} />
                    <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-v2-text">{g.name}</span>
                      <span className="block truncate text-v2-caption text-v2-text-3">{[[g.course, g.level].filter(Boolean).join(" · "), g.teacher, timeLabel(g.time)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {value.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-2">
              <span>{t("{n} ta guruh tanlandi", { n: value.length })}</span>
              <button type="button" onClick={() => onChange([])} className="font-semibold text-v2-brand-text hover:underline">
                {t("Tozalash")}
              </button>
            </div>
          )}
        </div>
      </FloatingPanel>
    </>
  );
}
