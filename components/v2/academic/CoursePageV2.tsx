"use client";

import { useState } from "react";
import { ArrowRight, Info, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { Avatar, NoticeBar, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import type { CoursePage } from "@/lib/coursePageTypes";

// YANGI VERSIYA — O'QUV BO'LIMI → KURSLAR → KURS SAHIFASI (36-qism, rasm «Kurs sahifasi»). Darajalar va narx,
// ustozlar, dars vaqtlari xaritasi va kitoblar bitta sahifada — hammasi guruhlardan o'zi yig'iladi.
// Server: /api/course-page (lib/coursePage.ts).

const som = (n: number) => n.toLocaleString("ru-RU");
const BOOK_BG = ["bg-v2-info-bg", "bg-v2-warning-bg", "bg-v2-success-bg", "bg-v2-danger-bg", "bg-v2-violet-bg"];

export default function CoursePageV2({ id }: { id: number }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { data: d, error, reload } = useReportData<CoursePage>(`/api/course-page?id=${id}`);
  const [book, setBook] = useState(false);
  const { showSuccess, showError } = useToast();
  const heat = (n: number, max: number) => (!n ? "bg-v2-surface-2 text-v2-text-3" : n >= max && max >= 2 ? "bg-v2-brand text-white" : n >= 2 ? "bg-v2-info-bg text-v2-text ring-1 ring-inset ring-v2-info/40" : "bg-v2-info-bg/60 text-v2-text");

  async function delBook(bid: number) {
    const r = await fetch("/api/course-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bid, delete: true }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t("O'chirib bo'lmadi"));
    showSuccess(t("O'chirildi"));
    reload();
  }

  if (error) return <PageShell flow><NoticeBar>{t("Kurs topilmadi")}</NoticeBar></PageShell>;
  if (!d)
    return (
      <PageShell flow>
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      </PageShell>
    );
  const k = d.kpi;
  const maxT = Math.max(1, ...d.times.flatMap((x) => [x.odd, x.even, x.other]));
  const busiest = d.times.flatMap((x) => [
    { n: x.odd, d: "toq kunlar", time: x.time },
    { n: x.even, d: "juft kunlar", time: x.time },
  ]).sort((a, b) => b.n - a.n)[0];

  return (
    <PageShell flow>
      <nav className="text-v2-small text-v2-text-2" aria-label={t("Yo'l")}>
        <Link href="/offline-courses" className="hover:text-v2-text">
          {t("Kurslar")}
        </Link>{" "}
        › <span className="text-v2-text">{d.course.name}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-v2-page text-v2-text">
            <span className={`size-3 rounded-[3px] ${FAN_DOT[fanOf(d.course.name)]}`} aria-hidden />
            {d.course.name}
          </h1>
          <p className="text-v2-small text-v2-text-2">{[d.course.category && t("{c} kategoriyasi", { c: d.course.category }), t("{n} filialda", { n: d.course.branches }), t("darajalar, narx, guruhlar, ustozlar va kitoblar bitta sahifada")].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/offline-courses/${id}/edit`} className={secondaryBtn}>
            {t("Tahrirlash")}
          </Link>
          <Link href="/groups?add=1" className={primaryBtn}>
            <Plus className="size-4" aria-hidden /> {t("Guruh ochish")}
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("Guruhlar")} value={String(k.groups)} sub={k.byBranch.map((b) => `${b.name} — ${b.n}`).join(" · ") || "—"} />
        <Kpi label={t("O'quvchilar")} value={String(k.pupils)} sub={k.groups ? t("guruhda o'rtacha {n}", { n: (k.pupils / k.groups).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) }) : "—"} />
        <Kpi label={t("Ustozlar")} value={String(k.teachers)} sub={k.topTeacher ? t("eng ko'p — {n}, {p}", { n: k.topTeacher.name, p: k.topTeacher.pupils }) : "—"} />
        <Kpi label={t("Davomat")} value={k.attendance === null ? "—" : `${k.attendance}%`} sub={t("{m} · markaz o'rtachasi {c}", { m: fmt.monthLower(k.month), c: k.centerAttendance === null ? "—" : `${k.centerAttendance}%` })} />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div>
              <h2 className="font-semibold text-v2-text">{t("Darajalar va narx")}</h2>
              <p className="text-v2-small text-v2-text-2">{t("oylik narx — kurs sozlamasidan, joriy filial")}</p>
            </div>
            <Link href={`/offline-courses/${id}?classic=1`} className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
              {t("Narxni o'zgartirish")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto border-t border-v2-border">
            <table className="w-full min-w-[520px] border-collapse text-v2-body">
              <thead>
                <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                  <th className={`${TH} pl-4`}>{t("Daraja")}</th>
                  <th className={`${TH} text-right`}>{t("Oylik narx")}</th>
                  <th className={`${TH} text-right`}>{t("Guruh")}</th>
                  <th className={`${TH} pr-4 text-right`}>{t("O'quvchi")}</th>
                </tr>
              </thead>
              <tbody>
                {d.levels.map((l) => (
                  <tr key={l.name} className="border-b border-v2-border last:border-b-0">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className={`font-semibold ${l.groups ? "text-v2-text" : "text-v2-text-2"}`}>{t(l.name)}</div>
                      {!l.groups && <div className="text-v2-small text-v2-text-3">{t("guruh hali ochilmagan")}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{l.price === null ? <span className="text-v2-warning">{t("kiritilmagan")}</span> : som(l.price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-v2-text">{l.groups || "—"}</td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-semibold tabular-nums text-v2-text">{l.pupils || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-2">{t("Narx o'zgarsa — keyingi oy to'lovlariga qo'llanadi; hozirgi oy hisob-kitobi o'zgarmaydi")}</p>
        </section>

        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="px-4 py-3">
            <h2 className="font-semibold text-v2-text">{t("Ustozlar · {n}", { n: d.teachers.length })}</h2>
            <p className="text-v2-small text-v2-text-2">{t("guruhlardan o'zi yig'iladi")}</p>
          </div>
          <ul className="divide-y divide-v2-border border-t border-v2-border">
            {d.teachers.map((x) => (
              <li key={x.name} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={x.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-v2-text">{x.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">{x.levels.join(", ") || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums text-v2-text">{x.pupils}</div>
                  <div className="text-v2-small text-v2-text-2">{t("{n} guruh · {b}", { n: x.groups, b: x.branches.join(", ") })}</div>
                </div>
              </li>
            ))}
            {!d.teachers.length && <li className="px-4 py-6 text-center text-v2-small text-v2-text-3">{t("Guruh yo'q")}</li>}
          </ul>
        </section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <h2 className="font-semibold text-v2-text">{t("Dars vaqtlari")}</h2>
          <p className="text-v2-small text-v2-text-2">{t("guruhlar soni")}</p>
          {d.times.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-1.5 text-v2-body">
                <thead>
                  <tr className="text-v2-small text-v2-text-2">
                    <th className="w-28" />
                    <th className="font-normal">{t("Toq kunlar")}</th>
                    <th className="font-normal">{t("Juft kunlar")}</th>
                    <th className="font-normal">{t("Boshqa kunlar")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.times.map((x) => (
                    <tr key={x.time}>
                      <th className="text-left text-v2-small font-semibold tabular-nums text-v2-text">{x.time}</th>
                      {[x.odd, x.even, x.other].map((n, i) => (
                        <td key={i} className={`h-9 rounded-v2-md text-center font-semibold tabular-nums ${heat(n, maxT)}`}>
                          {n || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Guruh yo'q")}</p>
          )}
          {busiest && busiest.n > 1 && <p className="mt-2 text-v2-small text-v2-text-2">{t("Eng talab — {d} {t}, {n} guruh.", { d: t(busiest.d), t: busiest.time, n: busiest.n })}</p>}
        </section>

        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex items-start justify-between gap-2 px-4 py-3">
            <div>
              <h2 className="font-semibold text-v2-text">{t("Kitoblar · {n}", { n: d.books.length })}</h2>
              <p className="text-v2-small text-v2-text-2">{t("darajaga biriktiriladi")}</p>
            </div>
            <button type="button" onClick={() => setBook(true)} className={secondaryBtn}>
              <Plus className="size-4" aria-hidden /> {t("Kitob qo'shish")}
            </button>
          </div>
          <ul className="divide-y divide-v2-border border-t border-v2-border">
            {d.books.map((b, i) => (
              <li key={b.id} className="group flex items-center gap-3 px-4 py-2.5">
                <span className={`h-10 w-8 shrink-0 rounded-[3px] border border-v2-border ${BOOK_BG[i % BOOK_BG.length]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-v2-text">{b.name}</div>
                  <div className="truncate text-v2-small text-v2-text-2">{[b.author, b.level ? t(b.level) : t("barcha darajalar")].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="text-v2-small text-v2-text-2">{t("{n} o'quvchida", { n: b.pupils })}</span>
                <button type="button" onClick={() => void delBook(b.id)} aria-label={t("O'chirish")} className="rounded-v2-sm p-1 text-v2-text-3 opacity-0 hover:text-v2-danger focus:opacity-100 group-hover:opacity-100">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
            {!d.books.length && <li className="px-4 py-6 text-center text-v2-small text-v2-text-3">{t("Kitob qo'shilmagan")}</li>}
          </ul>
        </section>
      </div>
      <p className="flex items-center gap-2 text-v2-small text-v2-text-2">
        <Info className="size-4" aria-hidden /> {t("Hafta kunlari, vaqtlar va ustozlar guruhlardan o'zi yig'iladi — qo'lda kiritilmaydi.")}
      </p>
      {book && <BookDialog courseId={id} levels={d.levels.map((l) => l.name).filter((n) => n !== "Darajasiz")} onClose={() => setBook(false)} onDone={reload} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-8 tabular-nums text-v2-text">{value}</div>
      <div className="line-clamp-2 text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function BookDialog({ courseId, levels, onClose, onDone }: { courseId: number; levels: string[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [level, setLevel] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(close: () => void) {
    setSaving(true);
    const r = await fetch("/api/course-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, name, author, level }) })
      .then((x) => x.json())
      .catch(() => null);
    setSaving(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Kitob qo'shildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Kitob qo'shish")}
      onClose={onClose}
      saving={saving}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={saving || !name.trim()} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Nomi")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="English File · Elementary" maxLength={120} />
        </Field>
        <Field label={t("Nashriyot / muallif")} optional>
          <TextInput value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Oxford" maxLength={80} />
        </Field>
        <Field label={t("Daraja")} hint={t("bo'sh — kursning barcha darajalari")}>
          <V2Select label={t("Daraja")} value={level} onChange={setLevel} options={[{ value: "", label: t("Barcha darajalar") }, ...levels.map((l) => ({ value: l, label: l }))]} searchable={false} />
        </Field>
      </div>
    </V2Dialog>
  );
}
