"use client";

import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ClipboardList, GraduationCap, Loader2, Moon, RotateCw, Search, SearchX, ShieldCheck, Sun } from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { dayMonthLabel } from "@/components/v2/ui/V2DateRange";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { CompareRow, ScoreBar, examBand } from "@/components/v2/imtihon/examBits";
import { CENTER_LOGO, CENTER_NAME } from "@/lib/center";
import { LANGS, type Lang } from "@/lib/i18n";
import { LANGS as LANG_LABELS } from "@/lib/navbar";
import { toCyrillic } from "@/lib/translit";
import { groupAvgPct, type PublicExam, type PublicExamStudent, type PublicResults } from "@/lib/imtihon";

// OCHIQ IMTIHON NATIJALARI — /natijalar (01.11.2026). Kirishsiz sahifa: o'quvchi
// Sarhisob'dagi «Ochiq havolani nusxalash» havolasini ochib o'z natijasini va
// qolgan ma'lumotni ko'radi — fan, guruh, ustoz, sana, savollar soni, guruh
// o'rtachasi, taqqoslash va guruhdagi o'rni. Telefon serverda yashirilgan
// (faqat oxirgi 4 raqam, lib/imtihon.ts → maskPhoneTail).
//
// Telefon uchun (Telegram'dan ochiladi): bir ustun, maydon 16px (iOS
// kattalashtirmasin), tanlov va qidiruv tepada. Oy/filial almashsa sahifa
// serverda qayta chiziladi (router.replace) — ro'yxat doim manzilga mos va
// havolani shu holicha ulashsa bo'ladi. Fan va qidiruv — shu yerda, bazasiz.
// Hisob Sarhisob bilan bir xil: o'rtacha — o'quvchi natijalari ustidan
// (SarhisobDetailDrawer → pupilAvgPct), daraja — examBand (≥80 / 60–79 / <60).

const MONTH_RE = /^(\d{4})-(\d{2})$/;
/** Faqat raqam (va + ( ) - bo'shliq) — telefon bo'yicha qidiruv. */
const PHONE_QUERY = /^[\d\s()+-]+$/;

type Hit = { exam: PublicExam; s: PublicExamStudent; rank: number };

function dateOfIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Qidiruv uchun: kichik harf, tutuq belgilari bitta ('), bo'shliqlar bitta. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[ʻʼ‘’`´]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Har so'z ismda bo'lsin (tartibi farqsiz). Lotinda tutuq belgisiz ham topadi
 * («Gulomov» → «Gʻulomov»); kirilda yozilsa — ism kirilga o'girilib solishtiriladi
 * (bazada ism lotinda; o'girish uchun tutuq belgisi kerak — shuning uchun alohida).
 */
function nameMatches(name: string, words: string[]): boolean {
  const lat = norm(name);
  const bare = lat.replace(/'/g, "");
  const cyr = toCyrillic(lat);
  return words.every((w) => bare.includes(w.replace(/'/g, "")) || cyr.includes(toCyrillic(w)));
}

/** Telefon: 2–3 raqam — oxirgi 4 raqam ichida; 4 va ko'p — oxirgi 4 tasi teng. */
function phoneMatches(masked: string, digits: string): boolean {
  const tail = masked.replace(/\D/g, "");
  if (tail.length !== 4 || digits.length < 2) return false;
  return digits.length >= 4 ? digits.slice(-4) === tail : tail.includes(digits);
}

/** O'rin — teng natija teng o'rin: 90, 85, 85, 70 → 1, 2, 2, 4. */
function ranksOf(students: PublicExamStudent[]): number[] {
  return students.map((s) => 1 + students.filter((x) => x.pct > s.pct).length);
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-v2-full text-v2-caption font-semibold tabular-nums ${
        rank <= 3 ? "bg-v2-brand-bg text-v2-brand-text" : "bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {rank}
    </span>
  );
}

function Pct({ pct, className = "" }: { pct: number; className?: string }) {
  return <span className={`font-semibold tabular-nums ${examBand(pct) === "low" ? "text-v2-warning" : "text-v2-text"} ${className}`}>{pct}%</span>;
}

function EmptyCard({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-v2-lg border border-v2-border bg-v2-surface px-6 py-10 text-center shadow-v2-sm">
      <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-3">{icon}</span>
      <div className="text-v2-section text-v2-text">{title}</div>
      {text && <p className="max-w-sm text-v2-small text-v2-text-2">{text}</p>}
      {children}
    </div>
  );
}

export default function PublicResultsPage({ data }: { data: PublicResults | null }) {
  const { t, months } = useT();
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [fCourse, setFCourse] = useState("");
  const [q, setQ] = useState("");
  const [toggled, setToggled] = useState<ReadonlySet<number>>(() => new Set());

  const monthLabel = (m: string) => {
    const x = MONTH_RE.exec(m);
    return x ? `${months[Number(x[2]) - 1]} ${x[1]}` : m;
  };
  const groupTitle = (e: PublicExam) => (/^\d+$/.test(e.groupName) ? t("{n}-guruh", { n: e.groupName }) : e.groupName || e.groupLabel);

  /** Oy/filial — manzil orqali (server qayta chizadi); filial almashsa oy — o'sha filialning oxirgisi. */
  function go(filial: number | null, oy: string | null) {
    const p = new URLSearchParams();
    if (filial !== null) p.set("filial", String(filial));
    if (oy) p.set("oy", oy);
    const s = p.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  }

  const exams = useMemo(() => data?.exams ?? [], [data]);
  const courseOptions = useMemo(
    () => [...new Set(exams.map((e) => e.course))].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c })),
    [exams],
  );
  // Boshqa oyga o'tganda tanlangan fan u yerda bo'lmasa — hammasi.
  const course = courseOptions.some((o) => o.value === fCourse) ? fCourse : "";
  const rows = useMemo(() => (course ? exams.filter((e) => e.course === course) : exams), [exams, course]);

  // Taqqoslash — Sarhisob tafsilotidagidek: shu oydagi (fan filtrisiz) barcha natijalar ustidan.
  const cmp = useMemo(() => {
    const byCourse = new Map<string, PublicExamStudent[]>();
    for (const e of exams) {
      const k = e.course.toLowerCase();
      const list = byCourse.get(k);
      if (list) list.push(...e.students);
      else byCourse.set(k, [...e.students]);
    }
    const all = exams.flatMap((e) => e.students);
    return {
      subj: new Map([...byCourse].map(([k, list]) => [k, groupAvgPct(list)] as const)),
      center: all.length ? groupAvgPct(all) : null,
    };
  }, [exams]);

  const words = useMemo(() => norm(q).split(" ").filter(Boolean), [q]);
  const digits = PHONE_QUERY.test(q.trim()) ? q.replace(/\D/g, "") : "";
  const hits = useMemo<Hit[] | null>(() => {
    if (words.length === 0) return null;
    const out: Hit[] = [];
    for (const exam of rows) {
      const ranks = ranksOf(exam.students);
      exam.students.forEach((s, i) => {
        if (digits ? phoneMatches(s.phone, digits) : nameMatches(s.name, words)) out.push({ exam, s, rank: ranks[i] });
      });
    }
    return out;
  }, [rows, words, digits]);

  const pupils = rows.flatMap((r) => r.students);
  const kpis = [
    { label: t("Sarhisob soni"), value: String(rows.length) },
    { label: t("Natija kiritilgan o'quvchi"), value: String(pupils.length) },
    { label: t("Markaz o'rtachasi"), value: pupils.length ? `${groupAvgPct(pupils)}%` : "—" },
    { label: t("Eng yuqori natija"), value: pupils.length ? `${Math.max(...pupils.map((s) => s.pct))}%` : "—" },
  ];

  // Ro'yxatda bitta guruh qolsa — u ochiq turadi (bosilsa yopiladi): toggled = sukutdan farqi.
  const isOpen = (id: number) => (rows.length === 1) !== toggled.has(id);
  const toggle = (id: number) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Qidiruv natijasidan guruhga: qidiruv tozalanadi, karta ochiladi va ko'rinadi. */
  function showGroup(id: number) {
    // Avval ro'yxat chizilsin (flushSync), keyin karta ko'rinadigan joyga aylantiriladi.
    flushSync(() => {
      setQ("");
      setToggled(new Set(rows.length === 1 ? [] : [id]));
    });
    document.getElementById(`exam-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const subtitle = data ? [data.branch?.name || t("Barcha filiallar"), data.month ? monthLabel(data.month) : null].filter(Boolean).join(" · ") : "";

  return (
    <div data-ui="v2" className="min-h-dvh bg-v2-bg font-v2 text-v2-text">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        {/* Logotip, til va mavzu */}
        <div className="flex items-center justify-between gap-3">
          {/* Logotip /sorovnoma'dagi — OQ, rangli fon uchun chizilgan: v2 «logotip» plashkasida. */}
          {CENTER_LOGO ? (
            <span className="inline-flex h-9 shrink-0 items-center rounded-v2-md bg-v2-logo px-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- statik logotip, o'lchami klassda */}
              <img src={CENTER_LOGO} alt={t(CENTER_NAME)} width={382} height={95} className="h-6 w-auto" />
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-logo text-white">
                <GraduationCap className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="truncate text-v2-section text-v2-text">{t(CENTER_NAME)}</span>
            </span>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <div role="group" aria-label={t("Til")} className="flex h-9 items-center gap-0.5 rounded-v2-md border border-v2-border-strong bg-v2-surface p-0.5">
              {LANGS.map((code: Lang) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`h-full rounded-v2-sm px-2.5 text-v2-small font-semibold transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                    lang === code ? "bg-v2-brand-bg text-v2-brand-text" : "text-v2-text-2 hover:text-v2-text"
                  }`}
                >
                  {LANG_LABELS[code].short}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
              title={isDark ? t("Kunduzgi rejim") : t("Tungi rejim")}
              className={secondaryIcon}
            >
              {isDark ? <Sun className="size-4" strokeWidth={1.75} aria-hidden /> : <Moon className="size-4" strokeWidth={1.75} aria-hidden />}
            </button>
          </div>
        </div>

        <header>
          <h1 className="flex items-center gap-2 text-v2-page text-v2-text">
            {t("Imtihon natijalari")}
            {pending && <Loader2 className="size-5 animate-spin text-v2-text-3" strokeWidth={2} aria-label={t("Yuklanmoqda…")} />}
          </h1>
          {subtitle && <p className="mt-1 text-v2-small text-v2-text-2">{subtitle}</p>}
        </header>

        {!data ? (
          <EmptyCard icon={<RotateCw className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Natijalarni yuklab bo'lmadi")} text={t("Internet aloqasini tekshirib, qayta urinib ko'ring.")}>
            <button type="button" onClick={() => startTransition(() => router.refresh())} disabled={pending} className={`${primaryBtn} mt-2 disabled:opacity-60`}>
              {t("Qayta urinish")}
            </button>
          </EmptyCard>
        ) : data.months.length === 0 ? (
          <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hozircha natijalar yo'q")} text={t("Imtihon natijalari kiritilgach shu yerda ko'rinadi.")} />
        ) : (
          <div aria-busy={pending} className={`flex flex-col gap-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
            {/* Tanlovlar va qidiruv */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <V2Select
                  variant="value"
                  label={t("Oy")}
                  value={data.month ?? ""}
                  onChange={(v) => {
                    if (v && v !== data.month) go(data.branch?.id ?? null, v);
                  }}
                  options={data.months.map((m) => ({ value: m, label: monthLabel(m) }))}
                  searchable={false}
                  clearable={false}
                />
                {data.branches.length > 1 && (
                  <V2Select
                    variant="value"
                    label={t("Filial")}
                    value={data.branch ? String(data.branch.id) : ""}
                    onChange={(v) => go(v ? Number(v) : null, null)}
                    options={[{ value: "", label: "Barcha filiallar" }, ...data.branches.map((b) => ({ value: String(b.id), label: b.name }))]}
                    searchable={false}
                    clearable={false}
                  />
                )}
                {courseOptions.length > 1 && <V2Select variant="chip" label={t("Fan")} value={course} onChange={setFCourse} options={courseOptions} />}
              </div>
              <div className="relative w-full sm:ml-auto sm:w-[300px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t("Ism yoki telefonning oxirgi 4 raqami")}
                  aria-label={t("Ism yoki telefonning oxirgi 4 raqami")}
                  className="h-10 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-base text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none sm:h-9 sm:text-v2-body"
                />
              </div>
            </div>

            {/* Ko'rsatkichlar — Sarhisob'dagi to'rttasi */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-v2-lg border border-v2-border bg-v2-border shadow-v2-sm sm:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="min-w-0 bg-v2-surface px-4 py-3">
                  <div className="text-v2-small font-medium leading-tight text-v2-text-2">{k.label}</div>
                  <div className="mt-1 text-[1.375rem] font-semibold leading-7 tabular-nums text-v2-text">{k.value}</div>
                </div>
              ))}
            </div>

            {hits ? (
              /* Qidiruv natijasi — o'quvchining o'z natijasi va guruhdagi o'rni */
              hits.length === 0 ? (
                <EmptyCard icon={<SearchX className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Hech narsa topilmadi")} text={t("Ism-familiyani yoki telefonning oxirgi 4 raqamini yozing.")} />
              ) : (
                <section className="flex flex-col gap-3">
                  <h2 className="text-v2-section text-v2-text">{t("{n} ta natija topildi", { n: hits.length })}</h2>
                  <ul className="flex flex-col gap-3">
                    {hits.map(({ exam, s, rank }, i) => {
                      const d = dateOfIso(exam.date);
                      const delta = s.pct - exam.avgPct;
                      return (
                        <li key={`${exam.id}-${i}`} className="rounded-v2-lg border border-v2-border bg-v2-surface px-4 py-3.5 shadow-v2-sm">
                          <div className="flex items-start gap-3">
                            <RankBadge rank={rank} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-v2-body font-semibold text-v2-text">{s.name}</div>
                              {s.phone && <div className="mt-0.5 text-v2-caption tabular-nums tracking-wide text-v2-text-2">{s.phone}</div>}
                            </div>
                            <div className="shrink-0 text-right">
                              <Pct pct={s.pct} className="text-[1.375rem] leading-7" />
                              <div className="text-v2-caption tabular-nums text-v2-text-2">
                                {s.correct} / {exam.total}
                              </div>
                            </div>
                          </div>
                          <ScoreBar pct={s.pct} className="mt-3 w-full" />
                          <div className="mt-3 flex min-w-0 items-center gap-2 text-v2-small">
                            <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(exam.course)]}`} aria-hidden />
                            <span className="min-w-0 truncate">
                              <span className="font-semibold text-v2-text">{exam.course}</span>
                              <span className="text-v2-text-2">
                                {" · "}
                                {groupTitle(exam)}
                                {exam.level ? ` · ${t(exam.level)}` : ""}
                              </span>
                            </span>
                          </div>
                          <div className="mt-0.5 text-v2-caption text-v2-text-2">
                            {[exam.teacher, d ? dayMonthLabel(d, lang) : exam.date, t("{rank}-o'rin · {n} tadan", { rank, n: exam.studentCount })].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-v2-caption text-v2-text-2">
                              {t("Guruh o'rtachasi")}: <span className="font-semibold tabular-nums text-v2-text">{exam.avgPct}%</span>
                              <span className={`ml-2 tabular-nums ${delta > 0 ? "text-v2-success" : delta < 0 ? "text-v2-danger" : "text-v2-text-3"}`}>
                                {delta > 0 ? "+" : ""}
                                {delta}% {t("guruhga nisbatan")}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => showGroup(exam.id)}
                              className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand-text underline-offset-2 hover:underline focus-visible:shadow-v2-focus focus-visible:outline-none"
                            >
                              {t("Guruh natijalari")}
                              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )
            ) : rows.length === 0 ? (
              <EmptyCard icon={<ClipboardList className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Bu oyda natijalar hali kiritilmagan")} text={t("Boshqa oyni tanlab ko'ring.")} />
            ) : (
              <section className="flex flex-col gap-3">
                <h2 className="text-v2-section text-v2-text">{data.month ? t("{month} sarhisoblari", { month: monthLabel(data.month) }) : t("Natijalar")}</h2>
                <ul className="flex flex-col gap-3">
                  {rows.map((exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                      title={groupTitle(exam)}
                      open={isOpen(exam.id)}
                      onToggle={() => toggle(exam.id)}
                      subjAvg={cmp.subj.get(exam.course.toLowerCase()) ?? null}
                      centerAvg={cmp.center}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-v2-caption text-v2-text-3">
          <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Telefon raqamning faqat oxirgi 4 raqami ko'rsatiladi")}
        </p>
      </div>
    </div>
  );
}

/** Guruh kartasi: yopiq — fan, guruh, ustoz, sana, o'rtacha; ochiq — taqqoslash va o'quvchilar o'rni bilan. */
function ExamCard({
  exam,
  title,
  open,
  onToggle,
  subjAvg,
  centerAvg,
}: {
  exam: PublicExam;
  title: string;
  open: boolean;
  onToggle: () => void;
  subjAvg: number | null;
  centerAvg: number | null;
}) {
  const { t } = useT();
  const [lang] = useLang();
  const panelId = useId();
  const d = dateOfIso(exam.date);
  const ranks = ranksOf(exam.students);

  return (
    <li id={`exam-${exam.id}`} className="scroll-mt-4 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-v2-surface-2 focus-visible:shadow-[inset_0_0_0_2px_var(--v2-brand)] focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(exam.course)]}`} aria-hidden />
            <span className="truncate text-v2-body font-semibold text-v2-text">{exam.course}</span>
          </span>
          <span className="mt-1 block text-v2-small text-v2-text">
            <span className="font-semibold">{title}</span>
            {exam.level ? <span className="text-v2-text-3"> · {t(exam.level)}</span> : null}
          </span>
          <span className="mt-0.5 block text-v2-caption text-v2-text-2">
            {[exam.teacher, d ? dayMonthLabel(d, lang) : exam.date, t("{total} ta savol", { total: exam.total }), t("{n} ta o'quvchi", { n: exam.studentCount })]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <span className="sr-only">{t("Guruh o'rtachasi")}</span>
          <Pct pct={exam.avgPct} className="text-v2-body" />
          <ScoreBar pct={exam.avgPct} className="w-16" />
        </span>
        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-v2-text-3 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="space-y-5 border-t border-v2-border px-4 pb-4 pt-4">
          <section>
            <h3 className="text-v2-small font-semibold text-v2-text">{t("Taqqoslash")}</h3>
            <div className="mt-2.5 space-y-3">
              <CompareRow label={t("Bu guruh")} value={exam.avgPct} strong />
              <CompareRow label={t("{course} · markaz o'rtachasi", { course: exam.course })} value={subjAvg} />
              <CompareRow label={t("Barcha fanlar · markaz")} value={centerAvg} />
            </div>
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-v2-small font-semibold text-v2-text">{t("O'quvchilar natijasi")}</h3>
              <span className="text-v2-caption text-v2-text-2">{t("{n} ta o'quvchi", { n: exam.studentCount })}</span>
            </div>
            <ol className="mt-2 divide-y divide-v2-border rounded-v2-md border border-v2-border">
              {exam.students.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <RankBadge rank={ranks[i]} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-v2-small font-semibold text-v2-text">{s.name}</div>
                    <div className="mt-0.5 text-v2-caption tabular-nums text-v2-text-2">
                      {s.phone && <span className="mr-2 tracking-wide">{s.phone}</span>}
                      {s.correct} / {exam.total}
                    </div>
                  </div>
                  <span className="hidden sm:block">
                    <ScoreBar pct={s.pct} className="w-[96px]" />
                  </span>
                  <Pct pct={s.pct} className="w-11 shrink-0 text-right text-v2-small" />
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </li>
  );
}
