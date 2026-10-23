"use client";

import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Calendar, Check, Link2, Loader2, Paperclip, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useModalClose } from "@/components/ui/Modal";
import V2Dialog from "@/components/v2/form/V2Dialog";
import V2DateField from "@/components/v2/form/V2DateField";
import V2TimeField from "@/components/v2/form/V2TimeField";
import { Field, FieldError, FieldHint, FieldLabel, TextInput, fieldCls } from "@/components/v2/form/fields";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useTaskForm, type TaskFormState } from "@/components/staff-tasks/useTaskForm";
import type { StaffFmt } from "@/components/staff-tasks/format";
import { PRIORITIES, type StaffTask, type StaffTaskBranch, type StaffTaskEmployee, type StaffTaskSettings } from "@/lib/staffTasks";
import { useTaskV2Fmt } from "./taskBitsV2";

// YANGI VERSIYA — «YANGI TOPSHIRIQ» OYNASI (rasm «Yangi topshiriq», yorug'/qorong'i,
// 23.10.2026): markazdagi oyna (V2Dialog), sarlavha + filial; maydonlar — Sarlavha,
// Tavsif (ixtiyoriy), Kimga (tanlangan xodimlar chip bo'lib, yonida «Xodim qo'shish…»
// qidiruvi; izoh: har biriga alohida nusxa), Muddat («📅 15-oktabr, payshanba» + soat),
// Muhimlik (1–5 katta tugmalar, ostida jarima summasi; tanlangani brend fonda),
// Ilova (uzuq chegarali maydon: rasm, PDF yoki havola). Pastda «Enter saqlash · Esc
// yopish», «Bekor qilish», «✓ Topshiriq berish».
//
// Mantiq eski forma bilan BITTA — components/staff-tasks/useTaskForm.ts (tekshiruv,
// fayl yuklash, POST/PATCH). Tahrirlash ham shu oyna («Topshiriqni tahrirlash»): xodim
// o'zgarmaydi, eski biriktirmalarni olib tashlash mumkin. Eski formadagi tezkor muddat
// tugmalari («Bugun 18:00», «Ertaga 12:00» …) rasmda yo'q — SAVOLLAR 138.

/** "2026-10-15" → mahalliy sana (taqvim maydoni uchun; faqat yil/oy/kun ishlatiladi). */
function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

export default function TaskFormDialogV2({
  task,
  initialEmployeeIds,
  employees,
  branches,
  settings,
  nowMs,
  fmt,
  onClose,
  onCreated,
  onUpdated,
}: {
  /** null — yangi topshiriq; aks holda tahrirlash. */
  task: StaffTask | null;
  initialEmployeeIds?: number[];
  employees: StaffTaskEmployee[];
  branches: StaffTaskBranch[];
  settings: StaffTaskSettings;
  nowMs: number;
  fmt: StaffFmt;
  /** Oyna yopilgach (saqlangan yoki bekor qilingan). */
  onClose: () => void;
  onCreated: (tasks: StaffTask[]) => void;
  onUpdated: (task: StaffTask) => void;
}) {
  const { t } = useT();
  const vf = useTaskV2Fmt();
  const branch = useBranch();
  const modal = useModalClose(onClose, "center");
  const form = useTaskForm({
    task,
    initialEmployeeIds,
    employees,
    branches,
    settings,
    nowMs,
    fmt,
    onCreated: (tasks) => {
      onCreated(tasks);
      modal.close();
    },
    onUpdated: (tk) => {
      onUpdated(tk);
      modal.close();
    },
  });
  const { editing, tried } = form;
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(() => !!task?.link);
  const [dragOver, setDragOver] = useState(false);

  // Sarlavhadagi filial: tanlangan xodimlarning filiali (topshiriq shu filialga
  // yoziladi — server xodimning ro'yxatdagi filialini oladi); hali tanlanmagan bo'lsa —
  // joriy filial.
  const subtitle = (() => {
    if (task) return [task.employeeName, form.branchName.get(task.branchId)].filter(Boolean).join(" · ");
    const names = [...new Set(form.sel.map((id) => form.empById.get(id)?.branchId).filter((x): x is number => x != null))]
      .map((id) => form.branchName.get(id))
      .filter(Boolean);
    if (names.length) return names.join(", ");
    return branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  })();

  const dirty = task
    ? form.title !== task.title ||
      form.desc !== task.desc ||
      form.link !== task.link ||
      form.prio !== task.priority ||
      form.dl !== Date.parse(task.deadline) ||
      form.added.length > 0 ||
      form.keep.length !== task.attachments.length
    : !!(form.title.trim() || form.desc.trim() || form.link.trim() || form.added.length);

  const dateObj = dateOfIso(form.date);
  const fine = fmt.money(form.fine);
  const many = !editing && form.sel.length > 1;

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void form.pickFiles(e.dataTransfer.files);
  }

  return (
    <V2Dialog
      controller={modal}
      title={t(editing ? "Topshiriqni tahrirlash" : "Yangi topshiriq")}
      subtitle={subtitle || undefined}
      onClose={onClose}
      dirty={dirty}
      saving={form.saving}
      onSubmit={() => void form.save()}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={form.saving} className={`${secondaryBtn} justify-center`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void form.save()} disabled={form.saving || form.uploading > 0} className={`${primaryBtn} justify-center disabled:opacity-60`}>
            {form.saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" strokeWidth={2} aria-hidden />}
            {t(editing ? "Saqlash" : "Topshiriq berish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Sarlavha */}
        <Field label={t("Sarlavha")} htmlFor="tfv2-title" error={tried && form.titleBad ? t("Sarlavhani kiriting") : undefined}>
          <TextInput
            id="tfv2-title"
            data-autofocus=""
            value={form.title}
            maxLength={200}
            onChange={(e) => form.setTitle(e.target.value)}
            placeholder={t("Masalan: Sentabr guruhlari jadvalini yangilash")}
            state={tried && form.titleBad ? "error" : "default"}
          />
        </Field>

        {/* Tavsif */}
        <Field label={t("Tavsif")} optional htmlFor="tfv2-desc">
          <textarea
            id="tfv2-desc"
            value={form.desc}
            rows={2}
            maxLength={4000}
            onChange={(e) => form.setDesc(e.target.value)}
            placeholder={t("Kutilayotgan natija, qayerdan olish, kimga topshirish")}
            className="block min-h-[60px] w-full resize-y rounded-v2-md border border-v2-border-field bg-v2-surface! px-3 py-2 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </Field>

        {/* Kimga */}
        {task ? (
          <Field label={t("Kimga")}>
            <div className={fieldCls("default", "flex items-center gap-2 bg-v2-surface-2! text-v2-text-2")}>
              <MiniAvatar name={task.employeeName} />
              <span className="truncate">{task.employeeName}</span>
            </div>
            <FieldHint>{t("Boshqa xodimga berish — yangi topshiriq.")}</FieldHint>
          </Field>
        ) : (
          <div className="min-w-0">
            <FieldLabel htmlFor="tfv2-who">{t("Kimga")}</FieldLabel>
            <StaffTagPicker form={form} employeesCount={employees.length} error={tried && form.empBad} />
            {tried && form.empBad ? (
              <FieldError>{t("Kamida bitta xodim tanlang")}</FieldError>
            ) : (
              <FieldHint>{t("Bir nechta xodim tanlansa, har biriga alohida nusxa boradi — holati va jarimasi o'ziniki.")}</FieldHint>
            )}
          </div>
        )}

        {/* Muddat */}
        <div className="min-w-0">
          <FieldLabel>{t("Muddat")}</FieldLabel>
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
            <V2DateField
              value={dateObj}
              onChange={(d) => form.setDate(isoOfDate(d))}
              trigger={(p, open) => (
                <button
                  type="button"
                  {...p}
                  className={fieldCls(tried && form.dlBad ? "error" : "default", `flex items-center gap-2 text-left ${open ? "border-v2-brand shadow-v2-focus" : ""}`)}
                >
                  <Calendar className="size-4 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{dateObj ? vf.dayLong(dateObj) : t("Sanani tanlang")}</span>
                </button>
              )}
            />
            <V2TimeField value={form.time} onChange={form.setTime} icon={false} ariaLabel={t("Soat")} state={tried && form.dlBad ? "error" : "default"} />
          </div>
          {tried && form.dlBad && <FieldError>{t("Muddat hozirgi vaqtdan keyin bo'lishi kerak")}</FieldError>}
        </div>

        {/* Muhimlik */}
        <div className="min-w-0">
          <FieldLabel>{t("Muhimlik")}</FieldLabel>
          <div role="radiogroup" aria-label={t("Muhimlik")} className="grid grid-cols-5 gap-2">
            {PRIORITIES.map((p) => {
              const on = form.prio === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => form.setPrio(p)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const next = Math.min(5, Math.max(1, p + (e.key === "ArrowRight" ? 1 : -1))) as typeof p;
                    form.setPrio(next);
                    (e.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
                  }}
                  tabIndex={on ? 0 : -1}
                  className={`flex h-[52px] min-w-0 flex-col items-center justify-center rounded-v2-md border transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                    on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                  }`}
                >
                  <span className="text-v2-body font-semibold tabular-nums">{p}</span>
                  <span className={`text-v2-caption font-normal tabular-nums ${on ? "text-v2-brand-text" : "text-v2-text-2"}`}>{fmt.num(settings.fines[String(p)] ?? 0)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-v2-caption font-normal text-v2-text-2">
            {many ? t("Bajarilmasa har biriga:") : t("Bajarilmasa:")} <b className="font-semibold text-v2-text">{fine}</b> {t("jarima.")}{" "}
            {t("Summalar Sozlamalar → Jarima va muddatlar'da.")}
          </p>
        </div>

        {/* Ilova */}
        <div className="min-w-0">
          <FieldLabel optional>{t("Ilova")}</FieldLabel>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex items-center gap-2 rounded-v2-md border border-dashed px-3 transition-colors ${dragOver ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border-strong bg-v2-surface"}`}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={form.uploading > 0}
              className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left text-v2-small text-v2-text-2 transition-colors hover:text-v2-text disabled:cursor-wait"
            >
              {form.uploading > 0 ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Paperclip className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />}
              <span className="truncate">{form.uploading > 0 ? t("Yuklanmoqda…") : t("Rasm, PDF yoki havola biriktiring")}</span>
            </button>
            {!linkOpen && (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-v2-sm px-1.5 text-v2-small font-medium text-v2-brand-text hover:bg-v2-brand-bg"
              >
                <Link2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("Havola")}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              aria-label={t("Fayl tanlash")}
              onChange={(e) => {
                void form.pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {linkOpen && (
            <div className="relative mt-2">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
              <TextInput value={form.link} onChange={(e) => form.setLink(e.target.value)} placeholder="https://" maxLength={500} aria-label={t("Havola")} className="pl-9" autoFocus={!task?.link} />
            </div>
          )}
          {(form.keep.length > 0 || form.added.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {task?.attachments.map((f, i) =>
                form.keep.includes(i) ? (
                  <FileTag key={`k${i}`} name={f.name} onRemove={() => form.setKeep((k) => k.filter((x) => x !== i))} />
                ) : null,
              )}
              {form.added.map((f, i) => (
                <FileTag key={`a${i}`} name={f.name} onRemove={() => form.setAdded((a) => a.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          <FieldHint>{t("Rasm yoki PDF, 10 MB gacha.")}</FieldHint>
        </div>
      </div>
    </V2Dialog>
  );
}

function MiniAvatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-[10px] font-semibold text-v2-brand-text">
      {initialsOf(name) || "?"}
    </span>
  );
}

function FileTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  const { t } = useT();
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface-2 pl-2 pr-1 text-v2-caption font-medium text-v2-text">
      <Paperclip className="size-3.5 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{name}</span>
      <button type="button" onClick={onRemove} aria-label={t("Olib tashlash")} className="inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-hover hover:text-v2-text">
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </span>
  );
}

/**
 * «Kimga» — tanlangan xodimlar chip bo'lib (bosh harflar + ism + ×), oxirida qidiruv
 * («Xodim qo'shish…»). Ro'yxat filial bo'yicha guruhlangan, guruhda «Hammasini
 * tanlash»; bir nechtasini ketma-ket tanlash mumkin (ro'yxat yopilmaydi).
 * Klaviatura: ↑↓ yurish, Enter tanlash/olib tashlash, Backspace (bo'sh qidiruvda) —
 * oxirgi chipni olib tashlash, Esc — ro'yxatni yopish.
 */
function StaffTagPicker({ form, employeesCount, error }: { form: TaskFormState; employeesCount: number; error: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const flat = form.groups.flatMap((g) => g.list);
  const indexOf = new Map(flat.map((e, i) => [e.id, i]));

  function pick(id: number) {
    const adding = !form.selSet.has(id);
    form.toggle(id);
    if (adding && form.q) form.setQ("");
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      if (!flat.length) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length;
      setActive(next);
      listRef.current?.querySelector<HTMLElement>(`[data-idx="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && open && flat[active]) {
      // Ro'yxatdan tanlash — oyna saqlanmasin (V2Dialog `defaultPrevented` ni tekshiradi).
      e.preventDefault();
      pick(flat[active].id);
    } else if (e.key === "Backspace" && !form.q && form.sel.length) {
      form.toggle(form.sel[form.sel.length - 1]);
    }
  }

  return (
    <>
      <div
        ref={boxRef}
        onMouseDown={(e) => {
          // Chip va bo'sh joyga bosish — qidiruvga fokus (× tugmasi o'zi ishlaydi).
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
        className={`flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-v2-md border bg-v2-surface px-1.5 py-1.5 transition-[border-color,box-shadow] ${
          focused || open ? "border-v2-brand shadow-v2-focus" : error ? "border-v2-danger" : "border-v2-border-field"
        }`}
      >
        {form.sel.map((id) => {
          const name = form.empById.get(id)?.name ?? `#${id}`;
          return (
            <span key={id} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-v2-full border border-v2-border bg-v2-surface-2 pl-1 pr-1 text-v2-small font-semibold text-v2-text">
              <MiniAvatar name={name} />
              <span className="truncate">{name}</span>
              <button
                type="button"
                onClick={() => form.toggle(id)}
                aria-label={t("{name} — olib tashlash", { name })}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-v2-text-3 hover:bg-v2-hover hover:text-v2-text"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id="tfv2-who"
          value={form.q}
          onChange={(e) => {
            form.setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={t("Xodim qo'shish…")}
          className="h-7 min-w-[140px] flex-1 bg-transparent! px-1.5 text-v2-body text-v2-text placeholder:text-v2-text-3 focus:outline-none"
        />
      </div>
      <FloatingPanel open={open} anchorRef={boxRef} onClose={() => setOpen(false)} maxHeight={300} role="listbox" id={listId} ariaLabel={t("Xodimlar")}>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
          {form.groups.length === 0 ? (
            <div className="px-3 py-6 text-center text-v2-small text-v2-text-3">
              {t(employeesCount ? "Mos xodim topilmadi" : "Topshiriq berish mumkin bo'lgan xodim yo'q")}
            </div>
          ) : (
            form.groups.map((g) => {
              const ids = g.list.map((e) => e.id);
              const all = ids.every((id) => form.selSet.has(id));
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-2">
                    <span className="truncate text-v2-caption text-v2-text-3">{g.name}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => form.toggleGroup(ids, all)}
                      className="shrink-0 text-v2-caption font-medium text-v2-brand-text hover:underline"
                    >
                      {t(all ? "Tanlovni olib tashlash" : "Hammasini tanlash")}
                    </button>
                  </div>
                  {g.list.map((e) => {
                    const i = indexOf.get(e.id) ?? 0;
                    const on = form.selSet.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        data-idx={i}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(e.id)}
                        className={`flex w-full items-center gap-2.5 rounded-v2-md px-2.5 py-2 text-left transition-colors ${i === active ? "bg-v2-surface-2" : "hover:bg-v2-surface-2"}`}
                      >
                        <span
                          aria-hidden
                          className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${on ? "border-v2-brand bg-v2-brand text-v2-on-brand" : "border-v2-border-field bg-v2-surface"}`}
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-v2-small font-medium text-v2-text">{e.name}</span>
                        {e.pos && <span className="shrink-0 text-v2-caption font-normal text-v2-text-3">{t(e.pos)}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        {form.sel.length > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-v2-border px-3 py-2 text-v2-caption">
            <span className="text-v2-text-2">{t("{n} ta xodim tanlandi", { n: form.sel.length })}</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)} className="font-medium text-v2-brand-text hover:underline">
              {t("Tayyor")}
            </button>
          </div>
        )}
      </FloatingPanel>
    </>
  );
}
