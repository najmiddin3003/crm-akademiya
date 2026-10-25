"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Award, Briefcase, CalendarClock, CalendarDays, Check, CircleX, Copy, ExternalLink, FileText, Loader2, RotateCcw, Send, UserRoundCheck, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { ToneBadge, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { CV_NOTE_MAX, cvExpLabel, type CvApplication, type CvFile } from "@/lib/managementCv";
import { CV_STEPS, CV_TONE, cvBranchLabel, cvCertText, cvExpPhrase, cvListText, cvPhoneShow, cvTel, cvTrackText, interviewParts, isTeaching, submittedParts } from "./cvBits";

// YANGI VERSIYA — NOMZOD PANELI (rasm «Ishga qabul · Nomzod paneli», yorug'/qorong'i, 25.10.2026):
//   sarlavha — avatar, ism, holat belgisi, «Ingliz tili · 4 yil tajriba», ×;
//   bosqich chizig'i Yangi → Ko'rildi → Suhbat → Ishga olindi (o'tganlari ✓, joriysi halqa);
//   suhbat kartasi (binafsha fon) «Suhbat · 14-oktabr | 15:00», joy, «O'zgartirish»;
//   bo'limlar: Aloqa, Ma'lumot, Tajriba, Ish sharoiti, Rezyume (+ eski anketa javoblari, admin izohi);
//   pastda «8-oktabr | 10:05 da kelgan», «Rad etish», «Ishga olish».

interface Props {
  cv: CvApplication;
  isAdmin: boolean;
  canHire: boolean;
  busy: boolean;
  onClose: () => void;
  onInterview: () => void;
  onReject: () => void;
  onHire: () => void;
  /** Rad etilgan / ishga olingan arizani qayta «Ko'rildi» ga. */
  onReopen: () => void;
  onUpdated: (cv: CvApplication) => void;
}

function fileUrl(cvId: number, kind: "cv" | "doc", i = 0): string {
  return `/api/management-cv/${cvId}/file?kind=${kind}${kind === "doc" ? `&i=${i}` : ""}`;
}

function fileKind(f: CvFile): string {
  const ext = /\.([a-z0-9]+)$/i.exec(f.name)?.[1]?.toUpperCase();
  if (ext) return ext;
  if (f.type === "application/pdf") return "PDF";
  if (f.type.startsWith("image/")) return f.type.slice(6).toUpperCase();
  return "Fayl";
}

function fmtSize(b: number): string {
  if (!b) return "";
  return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default function CvPanelV2({ cv, isAdmin, canHire, busy, onClose, onInterview, onReject, onHire, onReopen, onUpdated }: Props) {
  const { t } = useT();
  const f = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const status = cv.status;
  const reached = CV_STEPS.indexOf(status);
  const iv = interviewParts(cv.interviewAt);
  const sub = submittedParts(cv.submitted);
  const tel = cvTel(cv.phone);
  const phoneShow = cvPhoneShow(cv.phone) || "—";
  const exp = cvExpLabel(cv.experience || "");
  const track = cvTrackText(cv, t);
  const cert = cvCertText(cv, t);
  const birthYear = /^\d{4}/.test(cv.birth || "") ? cv.birth.slice(0, 4) : cv.birth || "";
  const edu = [cv.university, cv.specialty].filter((x) => x && x.trim()).join(" · ") + (cv.gradYear ? `, ${cv.gradYear}` : "");
  const work = [cv.workDays ? t(cv.workDays) : "", cv.workTime || ""].filter(Boolean).join(" · ");

  /* ---- Admin izohi ---- */
  const [note, setNote] = useState(cv.adminNote ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const noteChanged = note.trim() !== (cv.adminNote ?? "").trim();
  async function saveNote() {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/management-cv/${cv.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminNote: note }) });
      const d = await res.json();
      if (!d.ok) showError(t(d.error || "Saqlanmadi"));
      else {
        onUpdated(d.application as CvApplication);
        showSuccess(note.trim() ? t("Izoh saqlandi") : t("Izoh o'chirildi"));
      }
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
    setSavingNote(false);
  }

  const row = (label: string, value: ReactNode, key?: string) => (
    <div key={key ?? label} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-baseline gap-3 py-1.5 text-v2-small">
      <dt className="text-v2-text-2">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-v2-text">{value}</dd>
    </div>
  );
  const section = (title: string, rows: (ReactNode | null)[]) => {
    const list = rows.filter(Boolean);
    if (!list.length) return null;
    return (
      <section className="border-t border-v2-border px-5 py-4 first:border-t-0">
        <h3 className="mb-1.5 text-v2-caption font-medium text-v2-text-2">{title}</h3>
        <dl>{list}</dl>
      </section>
    );
  };
  const has = (v?: string | null) => Boolean(v && v.trim() && v.trim() !== "-");

  const legacy: [string, string][] = [
    ["O'qitgan joylari", cv.schools],
    ["Qaysi darajalarga", cv.certType ? "" : cv.levels],
    ["5 yillik rejasi", cv.plans5],
    ["Kutilayotgan natija", cv.results],
    ["Muhim omillar", (cv.priorities ?? []).join(", ")],
    ["Kuchli tomonlari", (cv.strengths ?? []).join(", ")],
    ["Qo'shimcha", cv.extra],
  ].filter((x): x is [string, string] => has(x[1]));

  const fileCard = (file: CvFile, href: string, key: string) => (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2.5 transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-danger-bg text-v2-danger" aria-hidden>
        <FileText className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-v2-small font-semibold text-v2-text">{file.name}</span>
        <span className="block text-v2-caption font-normal text-v2-text-2">{[fileKind(file), fmtSize(file.size)].filter(Boolean).join(" · ")}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
    </a>
  );

  return (
    <aside role="dialog" aria-modal="true" aria-label={cv.name} className="flex h-full w-full flex-col border-l border-v2-border bg-v2-surface text-v2-body text-v2-text shadow-v2-md">
      {/* Sarlavha */}
      <header className="shrink-0 border-b border-v2-border px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          {cv.photoUrl ? (
            <a href={cv.photoUrl} target="_blank" rel="noopener noreferrer" title={t("Rasmni kattalashtirish")} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:shadow-v2-focus">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cv.photoUrl} alt="" className="size-11 rounded-full object-cover" />
            </a>
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-v2-body font-semibold text-v2-brand-text" aria-hidden>
              {initialsOf(cv.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-v2-section text-v2-text" title={cv.name}>
              {cv.name}
            </h2>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <ToneBadge tone={CV_TONE[status]}>{t(CV_TONE[status].label)}</ToneBadge>
              <span className="min-w-0 truncate text-v2-small text-v2-text-2">{[track, cvExpPhrase(cv, t)].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title={t("Yopish")}
            aria-label={t("Yopish")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Bosqich chizig'i (rasmdagidek: birinchi doira chap chetda, oxirgisi o'ng chetda) */}
        <ol className="mt-4 flex items-start pb-5" aria-label={t("Bosqich")}>
          {CV_STEPS.map((s, i) => {
            const done = status !== "rejected" && (i < reached || (status === "accepted" && i === reached));
            const current = status !== "rejected" && status !== "accepted" && i === reached;
            const last = i === CV_STEPS.length - 1;
            const pos = i === 0 ? "left-0" : last ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <li key={s} className={`flex items-center ${last ? "" : "flex-1"}`} aria-current={current ? "step" : undefined}>
                <span className="relative shrink-0">
                  <span
                    className={`flex size-[22px] items-center justify-center rounded-full ${
                      done ? "bg-v2-brand text-v2-on-brand" : current ? "border-2 border-v2-brand bg-v2-surface" : "border-2 border-v2-border-strong bg-v2-surface"
                    }`}
                  >
                    {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    {current && <span className="size-2 rounded-full bg-v2-brand" aria-hidden />}
                  </span>
                  <span className={`absolute top-[28px] whitespace-nowrap text-v2-caption ${pos} ${current ? "font-semibold text-v2-text" : "font-normal text-v2-text-2"}`}>
                    {t(CV_TONE[s].label)}
                  </span>
                </span>
                {!last && <span aria-hidden className={`mx-1.5 h-0.5 flex-1 rounded-full ${status !== "rejected" && i < reached ? "bg-v2-brand" : "bg-v2-border-strong"}`} />}
              </li>
            );
          })}
        </ol>

        {status === "interview" && (
          <div className="mt-4 flex items-start gap-3 rounded-v2-md bg-v2-violet-bg px-3.5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface text-v2-violet" aria-hidden>
              <CalendarDays className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-v2-small font-semibold text-v2-text">{iv ? t("Suhbat · {when}", { when: f.stamp(iv.iso, iv.hm) }) : t("Suhbat vaqti belgilanmagan")}</div>
              {cv.interviewPlace && <div className="mt-0.5 truncate text-v2-caption font-normal text-v2-text-2">{cv.interviewPlace}</div>}
            </div>
            <button type="button" onClick={onInterview} className="shrink-0 rounded-v2-sm px-1 text-v2-small font-semibold text-v2-violet hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
              {iv ? t("O'zgartirish") : t("Belgilash")}
            </button>
          </div>
        )}
        {status === "accepted" && (
          <div className="mt-4 flex items-start gap-3 rounded-v2-md bg-v2-success-bg px-3.5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface text-v2-success" aria-hidden>
              <UserRoundCheck className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-v2-small font-semibold text-v2-text">{cv.hiredAt ? t("Ishga olindi · {date}", { date: f.dayMonth(cv.hiredAt) }) : t("Ishga olindi")}</div>
              {cv.hiredStart && <div className="mt-0.5 text-v2-caption font-normal text-v2-text-2">{t("Ish boshlash: {date}", { date: f.dayMonth(cv.hiredStart) })}</div>}
            </div>
            {cv.hiredEmpId && (
              <Link href={`/management-xodimlar/${cv.hiredEmpId}`} className="shrink-0 rounded-v2-sm px-1 text-v2-small font-semibold text-v2-success hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
                {t("Xodim profili")}
              </Link>
            )}
          </div>
        )}
        {status === "rejected" && (
          <div className="mt-4 flex items-start gap-3 rounded-v2-md bg-v2-danger-bg px-3.5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface text-v2-danger" aria-hidden>
              <CircleX className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-v2-small font-semibold text-v2-text">{t("Rad etildi")}</div>
              <div className="mt-0.5 text-v2-caption font-normal text-v2-text-2">{cv.rejectReason || t("Sabab yozilmagan")}</div>
            </div>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section(t("Aloqa"), [
          row(
            t("Telefon"),
            tel ? (
              <span className="inline-flex items-center gap-1.5">
                <a href={`tel:${tel}`} className="tabular-nums hover:underline">
                  {phoneShow}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(tel);
                    showSuccess(t("Nusxa olindi"));
                  }}
                  title={t("Nusxalash")}
                  aria-label={t("Raqamni nusxalash")}
                  className="inline-flex size-6 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text"
                >
                  <Copy className="size-3.5" strokeWidth={1.75} />
                </button>
              </span>
            ) : (
              "—"
            ),
          ),
          has(cv.telegram)
            ? row(
                "Telegram",
                <a href={`https://t.me/${encodeURIComponent(cv.telegram!)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-v2-brand-text hover:underline">
                  <Send className="size-3.5" strokeWidth={1.75} aria-hidden />@{cv.telegram}
                </a>,
              )
            : null,
          has(cv.address) ? row(t("Manzil"), cv.address) : null,
          birthYear ? row(t("Tug'ilgan yili"), birthYear) : null,
        ])}
        {section(t("Ma'lumot"), [
          has(cv.edu) ? row(t("Ta'lim darajasi"), t(cv.edu!)) : null,
          has(edu) ? row(t("Oliy ta'lim"), edu) : null,
          cert ? row(t("Sertifikat"), <span className="inline-flex items-center gap-1.5"><Award className="size-3.5 shrink-0 text-v2-text-2" strokeWidth={1.75} aria-hidden />{cert}</span>) : null,
        ])}
        {section(t("Tajriba"), [
          exp ? row(t("Ish tajribasi"), t(exp)) : null,
          has(cv.currentJob) ? row(t("Oldingi ish joyi"), cv.currentJob) : null,
          (cv.subjects?.length ?? 0) > 1 ? row(t("Fanlar"), track) : null,
          cv.certType && has(cv.levels) ? row(t("Yosh guruhlari"), cvListText(cv.levels, t)) : null,
        ])}
        {section(t("Ish sharoiti"), [
          // O'qituvchida sarlavhada fan turadi — lavozim shu yerda; boshqalarda sarlavhaning o'zi lavozim.
          isTeaching(cv) && has(cv.position) ? row(t("Lavozim"), t(cv.position)) : null,
          row(t("Filial"), cvBranchLabel(cv, t)),
          work ? row(t("Kunlar va vaqt"), work) : null,
          has(cv.load) ? row(t("Bandlik"), t(cv.load!)) : null,
          has(cv.startDate) ? row(t("Ish boshlash"), /^\d{4}-\d{2}-\d{2}$/.test(cv.startDate) ? f.dayMonth(cv.startDate) : cv.startDate) : null,
          has(cv.expectedSalary) ? row(t("Kutilayotgan oylik"), <span className="tabular-nums">{t("{sum} so'm", { sum: cv.expectedSalary })}</span>) : null,
        ])}
        {(cv.cvFile || (cv.docs ?? []).length > 0) && (
          <section className="border-t border-v2-border px-5 py-4">
            <h3 className="mb-2 text-v2-caption font-medium text-v2-text-2">{t("Rezyume")}</h3>
            <div className="space-y-2">
              {cv.cvFile && fileCard(cv.cvFile, fileUrl(cv.id, "cv"), "cv")}
              {(cv.docs ?? []).map((d, i) => fileCard(d, fileUrl(cv.id, "doc", i), `d${i}`))}
            </div>
          </section>
        )}
        {section(t("Qo'shimcha"), [
          has(cv.whyUs) ? row(t("Nega Akademiya?"), cv.whyUs) : null,
          has(cv.source) ? row(t("Qayerdan bildi"), t(cv.source!)) : null,
          has(cv.ref) ? row(t("Ariza raqami"), <span className="tabular-nums">{cv.ref}</span>) : null,
          has(cv.enteredBy) ? row(t("Kiritgan"), cv.enteredBy) : null,
          ...legacy.map(([k, v]) => row(t(k), v, k)),
        ])}
        {isAdmin && (
          <section className="border-t border-v2-border px-5 py-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-v2-caption font-medium text-v2-text-2">{t("Admin izohi")}</h3>
              <span className="text-v2-caption font-normal text-v2-text-3">{t("Faqat admin ko'radi")}</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, CV_NOTE_MAX))}
              rows={3}
              placeholder={t("Suhbatda nima gaplashildi, kelishuvlar, taassurot…")}
              className={`${fieldCls("default")} h-auto! min-h-[4.5rem] resize-y py-2`}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-v2-caption font-normal text-v2-text-3">
                {noteChanged ? t("Saqlanmagan o'zgarish bor") : cv.adminNoteBy ? t("Oxirgi o'zgarish: {name}", { name: cv.adminNoteBy }) : ""}
              </span>
              <button type="button" onClick={() => void saveNote()} disabled={!noteChanged || savingNote} className={`${secondaryBtn} h-8 disabled:cursor-not-allowed disabled:opacity-50`}>
                {savingNote && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t("Izohni saqlash")}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Pastki qator */}
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-v2-border px-5 py-3">
        <span className="min-w-0 flex-1 truncate text-v2-caption font-normal tabular-nums text-v2-text-2">
          {sub.iso ? t("{when} da kelgan", { when: f.stamp(sub.iso, sub.hm) }) : cv.submitted}
        </span>
        {status === "rejected" || status === "accepted" ? (
          status === "rejected" ? (
            <button type="button" onClick={onReopen} disabled={busy} className={`${secondaryBtn} disabled:opacity-60`}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />}
              {t("Qayta ko'rib chiqish")}
            </button>
          ) : null
        ) : (
          <>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-v2-md border border-v2-danger bg-v2-surface px-3 text-v2-body font-medium text-v2-danger transition-colors hover:bg-v2-danger-bg focus-visible:outline-none focus-visible:shadow-v2-focus disabled:opacity-60"
            >
              {t("Rad etish")}
            </button>
            {status !== "interview" && (
              <button type="button" onClick={onInterview} disabled={busy} className={`${secondaryBtn} disabled:opacity-60`}>
                <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Suhbatga chaqirish")}
              </button>
            )}
            <button
              type="button"
              onClick={onHire}
              disabled={busy || !canHire}
              title={canHire ? undefined : t("Xodim qo'shishga ruxsatingiz yo'q")}
              className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Briefcase className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Ishga olish")}
            </button>
          </>
        )}
      </footer>
    </aside>
  );
}
