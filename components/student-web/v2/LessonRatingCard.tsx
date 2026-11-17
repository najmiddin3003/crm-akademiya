"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Star } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { LESSON_TAGS, STAR_LABELS, type MyRating } from "@/lib/lessonRatingTypes";
import type { CabinetLesson } from "@/lib/studentCabinetTypes";
import { Card, CardHead, FanDot, Pill, addDays, timeRange, useCabinetFmt, type CabinetTabProps } from "./bits";
import { cameOf, isMarkKey } from "./lessonParts";

// O'QUVCHI KABINETI → «DARSNI BAHOLASH» (34-qism, rasm «O'quvchi kabineti · Darsni baholash · Telefon»).
// Kelgan va tugagan darslar (oxirgi `windowDays` kun) — «Darsni baholash» tugmasi; bosilsa pastdan oyna:
// 5 yulduz, «Nima yoqdi yoki yoqmadi?» teglari, izoh, «Ustozga ismingiz ko'rinmaydi». Pastda «Oxirgi
// baholarim». Server — POST /api/student-web/rating (lib/lessonRatings.ts), kirish — Telegram initData.

interface RatingState {
  ratings: MyRating[];
  rated: string[];
  windowDays: number;
}

export default function LessonRatingCard({ cab, initData }: Pick<CabinetTabProps, "cab" | "initData">) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [st, setSt] = useState<RatingState | null>(null);
  const [open, setOpen] = useState<CabinetLesson | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/student-web/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action: "list" }) })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok) setSt(j);
        })
        .catch(() => {}),
    [initData],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!st) return null;
  const since = addDays(cab.today, -st.windowDays);
  const due = cab.lessons.items
    .filter((l) => l.date >= since && l.date <= cab.today && l.mark && isMarkKey(l.mark) && cameOf(l.mark))
    .filter((l) => l.date < cab.today || (!!l.end && l.end <= cab.now))
    .filter((l) => !st.rated.includes(`${l.groupId}|${l.date}`))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  if (!due.length && !st.ratings.length) return null;

  return (
    <>
      {due.length > 0 && (
        <Card>
          <CardHead title={t("Darsni baholang")} sub={t("ustozga ismingiz ko'rinmaydi")} />
          <ul className="space-y-2">
            {due.map((l) => (
              <li key={`${l.groupId}|${l.date}`} className="rounded-v2-md border border-v2-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FanDot course={l.course} />
                      <span className="truncate font-semibold text-v2-text">{l.title}</span>
                    </div>
                    <div className="mt-0.5 pl-4 text-v2-caption text-v2-text-3">
                      {[l.date === cab.today ? t("Bugun") : fmt.dayMonth(l.date), timeRange(l.start, l.end), l.teacher].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Pill tone="success">{t("Keldim")}</Pill>
                </div>
                <button type="button" onClick={() => setOpen(l)} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-v2-md border border-v2-brand bg-v2-brand-bg font-semibold text-v2-brand-text">
                  {t("Darsni baholash")}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {st.ratings.length > 0 && (
        <Card>
          <CardHead title={t("Oxirgi baholarim")} />
          <ul className="divide-y divide-v2-border">
            {st.ratings.map((r) => (
              <li key={`${r.groupId}|${r.date}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-v2-text">{r.title}</div>
                  <div className="text-v2-caption text-v2-text-3">{fmt.dayMonth(r.date)}</div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums text-v2-text">
                  <Star className="size-4 fill-v2-warning text-v2-warning" strokeWidth={1.75} aria-hidden />
                  {r.stars}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {open && (
        <RateDialog
          lesson={open}
          initData={initData}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function RateDialog({ lesson, initData, onClose, onDone }: { lesson: CabinetLesson; initData: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function send(close: () => void) {
    if (!stars || saving) return;
    setSaving(true);
    const res = await fetch("/api/student-web/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, action: "submit", groupId: lesson.groupId, date: lesson.date, stars, tags, comment }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setErr(t(res?.error || "Yuborib bo'lmadi"));
      return;
    }
    close();
    onDone();
  }

  return (
    <V2Dialog
      title={t("Dars qanday o'tdi?")}
      subtitle={[lesson.title, lesson.teacher].filter(Boolean).join(" · ")}
      onClose={onClose}
      saving={saving}
      dirty={stars > 0 || !!comment}
      width={480}
      footer={(api) => (
        <button type="button" onClick={() => void send(api.close)} disabled={!stars || saving} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-50`}>
          {t("Bahoni yuborish")}
        </button>
      )}
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t("Baho")} className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t("{n} yulduz", { n })} onClick={() => setStars(n)} className="p-1">
              <Star className={`size-9 ${n <= stars ? "fill-v2-warning text-v2-warning" : "text-v2-border-strong"}`} strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <p className="h-5 text-center font-semibold text-v2-warning">{stars ? t(STAR_LABELS[stars]) : ""}</p>
        <div>
          <span className="mb-2 block text-v2-small font-semibold text-v2-text">{t("Nima yoqdi yoki yoqmadi?")}</span>
          <div className="flex flex-wrap gap-2">
            {LESSON_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTags((c) => (on ? c.filter((x) => x !== tag) : [...c, tag]))}
                  className={`h-10 rounded-full border px-4 text-v2-small font-semibold ${on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border text-v2-text"}`}
                >
                  {t(tag)}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-v2-small font-semibold text-v2-text">
            {t("Izoh")} <span className="font-normal text-v2-text-3">({t("ixtiyoriy")})</span>
          </span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} className="w-full rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 py-2 text-v2-body text-v2-text outline-none focus:shadow-v2-focus" />
        </label>
        <p className="flex items-center gap-2 text-v2-small text-v2-text-2">
          <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Ustozga ismingiz ko'rinmaydi — faqat baho va izoh")}
        </p>
        {err && <p className="text-v2-small text-v2-danger">{err}</p>}
      </div>
    </V2Dialog>
  );
}
