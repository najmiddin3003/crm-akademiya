"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Minus, X, type LucideIcon } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { DAY_STATUSES, dayStatusOf, type DayStatus } from "@/components/v2/groups/detail/groupDetailBits";
import type { LessonPupil, LessonSheet, TeacherLesson, TodayLessons } from "@/lib/teacherLessons";
import type { TelegramWebApp } from "./useTelegramWebApp";

// O'QITUVCHI DAVOMATI — «👤 Profilim» Mini App'i (05.11.2026, lib/teacherLessons.ts).
//
// LessonsCard     — profil tepasida bugungi darslar. Guruhi yo'q xodimda chizilmaydi.
// LessonSheetView — bitta guruhning bugungi davomati: saytdagi «Bugungi dars»
//                   qoidasi (TodayLessonTab.tsx) — hamma «Keldi» bo'lib ochiladi,
//                   ustoz faqat kelmaganlarni bosadi, «Saqlash» faqat o'zgarganlarni
//                   yuboradi. Tanga berish bu yerda yo'q — u saytda.

const STATUS_UI: Record<DayStatus, { label: string; icon: LucideIcon; on: string; text: string }> = {
  keldi: {
    label: "Keldi",
    icon: Check,
    on: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  sababsiz: {
    label: "Kelmadi",
    icon: X,
    on: "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
  },
  sababli: {
    label: "Sababli",
    icon: Minus,
    on: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
  },
};

const NOTE_MAX = 500;

function MarkBadge({ lesson }: { lesson: TeacherLesson }) {
  const { t } = useT();
  const { pupils, marked } = lesson;
  if (pupils > 0 && marked >= pupils) {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{t("Belgilandi")}</span>;
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
      {marked > 0 ? `${marked}/${pupils}` : t("Belgilanmagan")}
    </span>
  );
}

export function LessonsCard({ initData, onOpen }: { initData: string; onOpen: (groupId: number) => void }) {
  const { t } = useT();
  const [data, setData] = useState<TodayLessons | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/xodim/dars", { headers: { "x-telegram-init-data": initData } })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setData(d as TodayLessons);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [initData, attempt]);

  if (failed) {
    return (
      <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-[13px] text-muted-foreground">{t("Darslar yuklanmadi")}</p>
        <button
          type="button"
          onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}
          className="h-9 shrink-0 rounded-lg border border-border px-3 text-[13px] font-medium"
        >
          {t("Qayta urinish")}
        </button>
      </div>
    );
  }
  if (!data?.hasGroups) return null;

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="px-4 pb-2 pt-3 text-[13px] font-semibold text-muted-foreground">{t("Bugungi darslar")}</h2>
      {data.lessons.length === 0 ? (
        <p className="px-4 pb-3 text-sm">{t("Bugun darsingiz yo'q")}</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {data.lessons.map((l) => (
            <li key={l.groupId}>
              <button type="button" onClick={() => onOpen(l.groupId)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary">
                <span className="w-11 shrink-0 text-sm font-bold tabular-nums">{l.start || "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-snug">{l.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                    <span>{[l.room, t("{n} ta o'quvchi", { n: l.pupils })].filter(Boolean).join(" · ")}</span>
                    <MarkBadge lesson={l} />
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Draft {
  status: DayStatus;
  note: string;
}

interface Row {
  pupil: LessonPupil;
  eff: Draft;
  /** Bazadagidan farq qiladi (hali saqlanmagan «Keldi» ham) — shular yuboriladi. */
  changed: boolean;
  /** Ustozning o'zi o'zgartirgan — chiqishda ogohlantiriladi. */
  touched: boolean;
}

function toRows(pupils: LessonPupil[], edits: Record<number, Draft>): Row[] {
  return pupils.map((pupil) => {
    const saved: Draft | null = pupil.status ? { status: dayStatusOf(pupil.status) ?? "keldi", note: pupil.note } : null;
    const edit = edits[pupil.id];
    const eff = edit ?? saved ?? { status: "keldi", note: "" };
    const changed = !saved || eff.status !== saved.status || (eff.status !== "keldi" && eff.note.trim() !== saved.note.trim());
    return { pupil, eff, changed, touched: !!edit && changed };
  });
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Orqaga")}
      className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card active:bg-secondary"
    >
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}

export function LessonSheetView({
  groupId,
  initData,
  app,
  onBack,
}: {
  groupId: number;
  initData: string;
  app: TelegramWebApp | null;
  onBack: () => void;
}) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [sheet, setSheet] = useState<LessonSheet | null>(null);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/xodim/dars?guruh=${groupId}`, { headers: { "x-telegram-init-data": initData } })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.ok) setSheet(d.sheet as LessonSheet);
        else setError(t(d?.error || "Davomat yuklanmadi"));
      })
      .catch(() => {
        if (!cancelled) setError(t("Tarmoq xatosi — qayta urinib ko'ring"));
      });
    return () => { cancelled = true; };
  }, [groupId, initData, t]);

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <BackButton onClick={onBack} />
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{error}</p>
        </div>
      </div>
    );
  }
  if (!sheet) return <SpinnerBlock />;

  const rows = toRows(sheet.pupils, edits);
  const dirty = rows.some((r) => r.changed);
  const touched = rows.some((r) => r.touched);
  const pending = rows.some((r) => r.pupil.status === null);
  const counts: Record<DayStatus, number> = { keldi: 0, sababsiz: 0, sababli: 0 };
  for (const r of rows) counts[r.eff.status] += 1;
  const { lesson } = sheet;

  function setDraft(id: number, draft: Draft) {
    setLeaving(false);
    setEdits((e) => ({ ...e, [id]: draft }));
  }

  function back() {
    if (touched && !leaving) setLeaving(true);
    else onBack();
  }

  async function save() {
    const list = rows.filter((r) => r.changed);
    if (!list.length || saving) return;
    setSaving(true);
    const res = await fetch("/api/xodim/dars", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-init-data": initData },
      body: JSON.stringify({
        groupId,
        marks: list.map((r) => ({ pupilId: r.pupil.id, status: r.eff.status, note: r.eff.status === "keldi" ? "" : r.eff.note.trim() })),
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      app?.HapticFeedback?.notificationOccurred?.("error");
      showError(t(res?.error || "Tarmoq xatosi — qayta urinib ko'ring"));
      return;
    }
    const failed = res.failed as { pupilId: number; error: string }[];
    setSheet(res.sheet as LessonSheet);
    setLeaving(false);
    // Saqlanmaganlarining tahriri qoladi — ustoz qayta urinadi.
    setEdits((e) => Object.fromEntries(failed.filter((f) => e[f.pupilId]).map((f) => [f.pupilId, e[f.pupilId]])));
    if (failed.length > 0) {
      app?.HapticFeedback?.notificationOccurred?.("error");
      showError(t("{n} ta o'quvchining davomati saqlanmadi: {error}", { n: failed.length, error: t(failed[0].error) }));
      return;
    }
    app?.HapticFeedback?.notificationOccurred?.("success");
    showSuccess(t("Davomat saqlandi"));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center gap-3 p-4 pb-3">
        <BackButton onClick={back} />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold leading-tight">{lesson.title}</h1>
          <p className="truncate text-[12px] text-muted-foreground">{[lesson.time, lesson.room, lesson.branch].filter(Boolean).join(" · ")}</p>
        </div>
      </header>

      <div className="flex-1 px-4 pb-4">
        {pending && <p className="mb-3 text-[13px] text-muted-foreground">{t("Hamma «keldi» deb ochildi — faqat kelmaganlarni bosing.")}</p>}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm font-semibold">{t("Guruhda o'quvchi yo'q")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {rows.map((r) => {
              const name = r.pupil.name || t("Nomsiz o'quvchi");
              return (
                <li key={r.pupil.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{name}</span>
                    <div role="group" aria-label={name} className="flex shrink-0 gap-1.5">
                      {DAY_STATUSES.map((s) => {
                        const ui = STATUS_UI[s];
                        const Icon = ui.icon;
                        const on = r.eff.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={on}
                            aria-label={t(ui.label)}
                            title={t(ui.label)}
                            disabled={saving}
                            onClick={() => setDraft(r.pupil.id, { status: s, note: s === "keldi" ? "" : r.eff.note })}
                            className={`grid size-11 place-items-center rounded-xl border transition-colors disabled:opacity-60 ${on ? ui.on : "border-border text-muted-foreground"}`}
                          >
                            <Icon className="size-5" strokeWidth={on ? 2.5 : 2} aria-hidden />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {r.eff.status !== "keldi" && (
                    <input
                      type="text"
                      value={r.eff.note}
                      maxLength={NOTE_MAX}
                      disabled={saving}
                      aria-label={t("Izoh")}
                      placeholder={t("Izoh")}
                      onChange={(e) => setDraft(r.pupil.id, { status: r.eff.status, note: e.target.value })}
                      className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-primary"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rows.length > 0 && (
        <footer className="sticky bottom-0 z-10 border-t border-border bg-card px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          {leaving && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold">{t("Saqlanmagan o'zgarish bor")}</p>
              <button type="button" onClick={onBack} className="h-9 shrink-0 rounded-lg border border-border px-3 text-[13px] font-medium">
                {t("Saqlamasdan chiqish")}
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 gap-3 text-sm font-semibold tabular-nums">
              {DAY_STATUSES.map((s) => {
                const ui = STATUS_UI[s];
                const Icon = ui.icon;
                return (
                  <span key={s} title={t(ui.label)} className={`inline-flex items-center gap-1 ${ui.text}`}>
                    <Icon className="size-4" strokeWidth={2.5} aria-hidden />
                    <span className="sr-only">{t(ui.label)}</span>
                    {counts[s]}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="h-11 shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? t("Saqlanmoqda…") : t("Saqlash")}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
