"use client";

import { Loader2, Paperclip, X } from "lucide-react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import TimeField from "@/components/ui/TimeField";
import SearchInput from "@/components/ui/SearchInput";
import {
  PRIORITIES,
  uzDateOf,
  uzTimeOf,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskSettings,
} from "@/lib/staffTasks";
import type { StaffFmt } from "./format";
import { useTaskForm } from "./useTaskForm";

// TOPSHIRIQ QO'SHISH / TAHRIRLASH — drawer ichidagi forma (prototipdagi
// openForm). Bir nechta xodim tanlansa har biriga ALOHIDA topshiriq
// yaratiladi — o'z holati va o'z jarimasi bilan. Tahrirlashda xodim
// o'zgarmaydi (boshqa odamga berish — yangi topshiriq). Mantiq — useTaskForm.ts
// (yangi versiyadagi «Yangi topshiriq» oynasi bilan umumiy).

interface Props {
  task: StaffTask | null;
  /** Yangi topshiriqda oldindan tanlangan xodim(lar) — faqat ro'yxatda bori olinadi. */
  initialEmployeeIds?: number[];
  employees: StaffTaskEmployee[];
  branches: StaffTaskBranch[];
  settings: StaffTaskSettings;
  nowMs: number;
  fmt: StaffFmt;
  /** Saqlash ketayotganini drawer'ga aytadi (Esc/overlay bloklanadi). */
  onBusy: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (tasks: StaffTask[]) => void;
  onUpdated: (task: StaffTask) => void;
}

/** ui/Button `variant="outline"` klasslari — fayl tanlash yorlig'i uchun. */
export const FILE_BTN =
  "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium border border-border bg-card hover:bg-secondary transition-colors cursor-pointer";

export default function TaskForm({ task, initialEmployeeIds, employees, branches, settings, nowMs, fmt, onBusy, onCancel, onCreated, onUpdated }: Props) {
  const { t, num } = fmt;
  const {
    editing,
    title,
    setTitle,
    desc,
    setDesc,
    link,
    setLink,
    prio,
    setPrio,
    date,
    setDate,
    time,
    setTime,
    sel,
    q,
    setQ,
    keep,
    setKeep,
    added,
    setAdded,
    uploading,
    saving,
    tried,
    dl,
    dlBad,
    titleBad,
    empBad,
    branchName,
    groups,
    selSet,
    empById,
    toggle,
    toggleGroup,
    quick,
    pickFiles,
    save,
    summary,
  } = useTaskForm({ task, initialEmployeeIds, employees, branches, settings, nowMs, fmt, onBusy, onCreated, onUpdated });

  return (
    <>
      <div className="stk-dhead">
        <div className="stk-dhl">
          <h2 style={{ marginTop: 0 }}>{t(editing ? "Topshiriqni tahrirlash" : "Topshiriq qo'shish")}</h2>
          <div className="stk-dsub">
            {t(
              editing
                ? "Xodim «Bajardim» bosgunga qadar o'zgartirish mumkin; o'zgarishlar tarixga yoziladi."
                : "Bir nechta xodim tanlansa har biriga alohida topshiriq yaratiladi — o'z holati va o'z jarimasi bilan.",
            )}
          </div>
        </div>
        <button type="button" className="stk-dx" onClick={onCancel} aria-label={t("Yopish")} disabled={saving}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="stk-dbody">
        <div className="stk-field">
          <label className="stk-label" htmlFor="stk-title">
            {t("Sarlavha")} <small>{t("(majburiy)")}</small>
          </label>
          <input
            id="stk-title"
            className={`stk-input ${tried && titleBad ? "is-err" : ""}`}
            value={title}
            maxLength={200}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Masalan: Sentabr guruhlari jadvalini yangilash")}
          />
          {tried && titleBad && <div className="stk-err">{t("Sarlavhani kiriting")}</div>}
        </div>

        <div className="stk-field">
          <label className="stk-label" htmlFor="stk-desc">{t("Nima qilish kerak")}</label>
          <textarea
            id="stk-desc"
            className="stk-input"
            value={desc}
            maxLength={4000}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t("Kutilayotgan natija, qayerdan olish, kimga topshirish")}
          />
        </div>

        {task ? (
          <div className="stk-field">
            <label className="stk-label">{t("Xodim")}</label>
            <input className="stk-input" value={`${task.employeeName}, ${branchName.get(task.branchId) ?? ""}`} disabled />
          </div>
        ) : (
          <div className="stk-field">
            <label className="stk-label">
              {t("Kimga")} <small>{t("(bir nechta tanlash mumkin)")}</small>
            </label>
            {sel.length > 0 && (
              <div className="stk-pills">
                {sel.map((id) => (
                  <span key={id} className="stk-pill">
                    {empById.get(id)?.name ?? id}
                    <button type="button" onClick={() => toggle(id)} aria-label={t("Olib tashlash")}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <SearchInput className="stk-emp-tools" value={q} onChange={setQ} placeholder="Ism bo'yicha qidirish" />
            <div className={`stk-emp-list ${tried && empBad ? "is-err" : ""}`}>
              {groups.length === 0 ? (
                <div className="none">{t(employees.length ? "Mos xodim topilmadi" : "Topshiriq berish mumkin bo'lgan xodim yo'q")}</div>
              ) : (
                groups.map((g) => {
                  const ids = g.list.map((e) => e.id);
                  const all = ids.every((id) => selSet.has(id));
                  return (
                    <div key={g.id}>
                      <div className="g">
                        <span>{g.name}</span>
                        <button type="button" onClick={() => toggleGroup(ids, all)}>
                          {t(all ? "Tanlovni olib tashlash" : "Hammasini tanlash")}
                        </button>
                      </div>
                      {g.list.map((e) => (
                        <label key={e.id}>
                          <input type="checkbox" checked={selSet.has(e.id)} onChange={() => toggle(e.id)} />
                          {e.name}
                          {e.pos && <span>{t(e.pos)}</span>}
                        </label>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
            {tried && empBad && <div className="stk-err">{t("Kamida bitta xodim tanlang")}</div>}
          </div>
        )}

        <div className="stk-field">
          <label className="stk-label">{t("Deadline")}</label>
          {quick.length > 0 && (
            <div className="stk-quick">
              {quick.map((x) => (
                <button
                  key={x.label}
                  type="button"
                  className={dl === x.at ? "is-on" : ""}
                  onClick={() => {
                    setDate(uzDateOf(x.at));
                    setTime(uzTimeOf(x.at));
                  }}
                >
                  {t(x.label)}
                </button>
              ))}
            </div>
          )}
          <div className="stk-two">
            <DateField value={date} onChange={setDate} variant="form" error={tried && dlBad} />
            <TimeField value={time} onChange={setTime} variant="form" error={tried && dlBad} />
          </div>
          {tried && dlBad && <div className="stk-err">{t("Deadline hozirgi vaqtdan keyin bo'lishi kerak")}</div>}
        </div>

        <div className="stk-field">
          <label className="stk-label">
            {t("Muhimlik")} <small>{t("(bajarilmasa yoziladigan jarima)")}</small>
          </label>
          <div className="stk-prio-pick" role="radiogroup">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={prio === p} className={prio === p ? "is-on" : ""} onClick={() => setPrio(p)}>
                <b>{p}</b>
                <small>{num(settings.fines[String(p)] ?? 0)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="stk-field">
          <label className="stk-label">
            {t("Biriktirma")} <small>{t("(rasm yoki PDF, 10 MB gacha)")}</small>
          </label>
          <div className="stk-attach">
            {/* <label> — <button> ichida <input> bo'lmaydi; ko'rinishi ui/Button (outline) bilan bir xil. */}
            <label className={`stk-file-btn ${FILE_BTN} ${uploading > 0 ? "pointer-events-none opacity-60" : ""}`}>
              {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {t(uploading > 0 ? "Yuklanmoqda…" : "Fayl tanlash")}
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf"
                aria-label={t("Fayl tanlash")}
                onChange={(e) => {
                  void pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <input className="stk-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("yoki havola: https://")} maxLength={500} />
          </div>
          {(keep.length > 0 || added.length > 0) && (
            <div className="stk-files">
              {task?.attachments.map((f, i) =>
                keep.includes(i) ? (
                  <span key={`k${i}`} className="stk-tag">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <button type="button" className="stk-tag-x" onClick={() => setKeep((k) => k.filter((x) => x !== i))} aria-label={t("Olib tashlash")}>
                      ×
                    </button>
                  </span>
                ) : null,
              )}
              {added.map((f, i) => (
                <span key={`a${i}`} className="stk-tag">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="stk-tag-x" onClick={() => setAdded((a) => a.filter((_, j) => j !== i))} aria-label={t("Olib tashlash")}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="stk-summary">{summary}</div>
      </div>

      <div className="stk-dfoot">
        <Button variant="primary" onClick={save} disabled={saving || uploading > 0}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(editing ? "Saqlash" : "Topshiriq berish")}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t("Bekor")}
        </Button>
      </div>
    </>
  );
}
