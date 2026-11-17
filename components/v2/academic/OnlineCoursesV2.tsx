"use client";

import { useRef, useState } from "react";
import { CheckSquare, Loader2, Pencil, PlayCircle, Plus, Trash2, Upload } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { Field, TextInput } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar, PageHead, PageShell, SegmentPills } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { fmtDur, type OnlineCourseRow, type OnlineCoursesPayload, type OnlineModule } from "@/lib/onlineCourseAdminTypes";

// YANGI VERSIYA — O'QUV BO'LIMI → «ONLAYN KURSLAR» (36-qism, rasm «Onlayn kurslar»). Kurslar kartalari (ustoz,
// darslar, modullar, davomiylik, bepul/pullik, o'quvchilar, tugatganlar, test), o'ngda tanlangan kurs tuzilmasi:
// modullar → darslar (video, davomiylik) va modul testi. «Dars qo'shish», «Kurs yaratish» — eski g'ilofchi.
// Server: /api/online-course-admin (lib/onlineCourseAdmin.ts).

type Tab = "all" | "active" | "draft";
const COVER = ["bg-v2-info-bg text-v2-info", "bg-v2-success-bg text-v2-success", "bg-v2-violet-bg text-v2-violet", "bg-v2-warning-bg text-v2-warning", "bg-v2-danger-bg text-v2-danger"];
const som = (n: number) => n.toLocaleString("ru-RU");
const mmss = (m: number, s: number) => `${m}:${String(s).padStart(2, "0")}`;

export default function OnlineCoursesV2() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("all");
  const [teacher, setTeacher] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [lesson, setLesson] = useState<{ moduleId: string | null } | null>(null);
  const [meta, setMeta] = useState(false);
  const { data: d, error, reload } = useReportData<OnlineCoursesPayload>("/api/online-course-admin");
  const all = d?.rows ?? [];
  const rows = all.filter((r) => (tab === "all" || (tab === "active" ? r.published : !r.published)) && (!teacher || r.teacher === teacher));
  const cur = rows.find((r) => r.id === sel) ?? rows[0] ?? null;
  const k = d?.kpi;

  return (
    <PageShell flow>
      <PageHead
        title={t("Onlayn kurslar")}
        subtitle={t("Video darslar va testlar — o'quvchi kabinetida o'tadi · guruh darsiga qo'shimcha yoki alohida pullik kurs")}
        actions={
          <Link href="/online-courses/add" className={primaryBtn}>
            <Plus className="size-4" aria-hidden /> {t("Kurs yaratish")}
          </Link>
        }
      />
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && k && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills<Tab>
              items={[
                { key: "all", label: t("Hammasi"), count: all.length },
                { key: "active", label: t("Faol"), count: all.filter((r) => r.published).length },
                { key: "draft", label: t("Qoralama"), count: all.filter((r) => !r.published).length },
              ]}
              value={tab}
              onChange={setTab}
            />
            <V2Select variant="chip" label={t("Ustoz")} emptyLabel="Hammasi" value={teacher} onChange={setTeacher} options={[...new Set(all.map((r) => r.teacher).filter(Boolean))].map((x) => ({ value: x, label: x }))} searchable={false} />
            <span className="ml-auto hidden text-v2-small text-v2-text-2 lg:inline">{t("video Tizimli serverida · yuklab olib bo'lmaydi")}</span>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("O'quvchilar")} value={String(k.pupils)} sub={t("kamida bitta darsni ochgan")} />
            <Kpi label={t("Tugatganlar")} value={String(k.finished)} badge={k.pupils ? `${Math.round((k.finished / k.pupils) * 100)}%` : undefined} sub={t("barcha darslar va testlar")} />
            <Kpi label={t("O'rtacha test")} value={k.testAvg === null ? "—" : `${k.testAvg}%`} sub={t("har modul oxiridagi test")} />
            <Kpi label={t("Pullik kurs tushumi")} value={`${som(k.revenue)}`} unit="so'm" sub={k.paidName ? t("{n} · {p} o'quvchi", { n: k.paidName, p: k.paidPupils }) : t("pullik kurs yo'q")} />
          </section>
          {!k.pupils && <NoticeBar>{t("O'quvchi kabinetidagi video pleer keyingi bosqichda ulanadi — shungacha o'quvchi va test ko'rsatkichlari 0 bo'lib turadi.")}</NoticeBar>}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-3">
              {rows.map((r, i) => (
                <CourseCard key={r.id} r={r} i={i} on={cur?.id === r.id} onClick={() => setSel(r.id)} />
              ))}
              {!rows.length && <p className="rounded-v2-lg border border-dashed border-v2-border-strong p-8 text-center text-v2-small text-v2-text-3">{t("Kurs yo'q — «Kurs yaratish»")}</p>}
            </div>
            {cur && <Structure r={cur} onAdd={(moduleId) => setLesson({ moduleId })} onMeta={() => setMeta(true)} onChange={reload} />}
          </div>
        </>
      )}
      {lesson && cur && <LessonDialog r={cur} moduleId={lesson.moduleId} onClose={() => setLesson(null)} onDone={reload} />}
      {meta && cur && <MetaDialog r={cur} onClose={() => setMeta(false)} onDone={reload} />}
    </PageShell>
  );
}

function Kpi({ label, value, sub, badge, unit }: { label: string; value: string; sub: string; badge?: string; unit?: string }) {
  return (
    <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="text-v2-small text-v2-text-2">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-8 tabular-nums text-v2-text">
        {value} {unit && <span className="text-v2-small font-normal text-v2-text-2">{unit}</span>} {badge && <span className="text-v2-small font-semibold text-v2-success">{badge}</span>}
      </div>
      <div className="truncate text-v2-small text-v2-text-2">{sub}</div>
    </div>
  );
}

function CourseCard({ r, i, on, onClick }: { r: OnlineCourseRow; i: number; on: boolean; onClick: () => void }) {
  const { t } = useT();
  const pct = r.pupils ? Math.round((r.finished / r.pupils) * 100) : 0;
  return (
    <button type="button" onClick={onClick} className={`flex w-full gap-4 rounded-v2-lg border p-3 text-left shadow-v2-sm transition-colors ${on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface hover:bg-v2-hover"}`}>
      <span className={`hidden h-[84px] w-[120px] shrink-0 items-end rounded-v2-md p-2.5 text-v2-caption font-bold uppercase sm:flex ${r.published ? COVER[i % COVER.length] : "bg-v2-surface-2 text-v2-text-2"}`}>{r.name.split(/[·\s]/)[0]}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-v2-text">{r.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${r.published ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>{r.published ? t("Faol") : t("Qoralama")}</span>
        </span>
        <span className="block text-v2-small text-v2-text-2">{[r.teacher, t("{n} dars", { n: r.lessons }), t("{n} modul", { n: r.modules.length }), r.minutes ? fmtDur(r.minutes) : "", r.ready < r.lessons ? t("{n} tasi tayyor", { n: r.ready }) : ""].filter(Boolean).join(" · ")}</span>
        <span className="block text-v2-small text-v2-text">{r.published ? [r.free ? t("Bepul") : t("Pullik · {p} so'm · kassada to'lanadi, kabinetda ochiladi", { p: som(r.price) }), r.audience].filter(Boolean).join(" · ") : t("Hali e'lon qilinmagan")}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-v2-small text-v2-text-2">
          <span>
            <b className="text-v2-text">{r.pupils || "—"}</b> {t("o'quvchi")}
          </span>
          <span>
            <b className="text-v2-text">{r.pupils ? `${r.finished} · ${pct}%` : "—"}</b> {t("tugatdi")}
          </span>
          <span>
            {t("test")} <b className="text-v2-text">{r.testAvg === null ? "—" : `${r.testAvg}%`}</b>
          </span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-v2-surface-2">
            <span className="block h-full rounded-full bg-v2-success" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </span>
    </button>
  );
}

function Structure({ r, onAdd, onMeta, onChange }: { r: OnlineCourseRow; onAdd: (moduleId: string | null) => void; onMeta: () => void; onChange: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [open, setOpen] = useState<string | null>(r.modules[0]?.id ?? null);
  async function post(body: Record<string, unknown>, ok: string) {
    const res = await fetch("/api/online-course-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, ...body }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(ok);
    onChange();
  }
  const removeLesson = (mid: string, lid: string) => void post({ modules: r.modules.map((m) => (m.id === mid ? { ...m, lessons: m.lessons.filter((l) => l.id !== lid) } : m)) }, t("Dars o'chirildi"));
  return (
    <aside className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-v2-small text-v2-text-2">{t("Tuzilma")}</div>
          <div className="text-[17px] font-semibold text-v2-text">{r.name}</div>
          <button type="button" onClick={onMeta} className="inline-flex items-center gap-1 text-left text-v2-small text-v2-text-2 hover:text-v2-brand">
            {[r.audience || t("auditoriya yozilmagan"), r.teacher || t("ustoz yo'q")].join(" · ")} <Pencil className="size-3" aria-hidden />
          </button>
        </div>
        <button type="button" onClick={() => onAdd(open)} className={secondaryBtn}>
          <Plus className="size-4" aria-hidden /> {t("Dars qo'shish")}
        </button>
      </div>
      <ol className="divide-y divide-v2-border border-t border-v2-border">
        {r.modules.map((m, i) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-v2-hover">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-small font-semibold text-v2-brand">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-v2-text">{m.name}</span>
                <span className="block text-v2-small text-v2-text-2">{[t("{n} video", { n: m.lessons.length }), m.testQuestions ? t("test") : ""].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="w-20 text-right text-v2-small text-v2-text-2">
                {t("{p}% o'tdi", { p: r.moduleProgress[i] ?? 0 })}
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-v2-surface-2">
                  <span className="block h-full bg-v2-success" style={{ width: `${r.moduleProgress[i] ?? 0}%` }} />
                </span>
              </span>
            </button>
            {open === m.id && (
              <ul className="pb-2 pl-14 pr-4">
                {m.lessons.map((l) => (
                  <li key={l.id} className="group flex items-center gap-2.5 py-1.5 text-v2-small">
                    <PlayCircle className={`size-4 shrink-0 ${l.video ? "text-v2-info" : "text-v2-text-3"}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-v2-text">{l.title}</span>
                    <span className="tabular-nums text-v2-text-2">{l.video ? mmss(l.minutes, l.seconds) : t("rejada")}</span>
                    <button type="button" onClick={() => removeLesson(m.id, l.id)} aria-label={t("O'chirish")} className="text-v2-text-3 opacity-0 hover:text-v2-danger focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
                {m.testQuestions > 0 && (
                  <li className="flex items-center gap-2.5 py-1.5 text-v2-small">
                    <CheckSquare className="size-4 shrink-0 text-v2-success" aria-hidden />
                    <span className="flex-1 text-v2-text">{t("Test · {n} savol", { n: m.testQuestions })}</span>
                    <span className="text-v2-text-2">{r.moduleTest[i] === null ? "—" : t("o'rtacha {p}%", { p: r.moduleTest[i] ?? 0 })}</span>
                  </li>
                )}
                {!m.lessons.length && <li className="py-1.5 text-v2-small text-v2-text-3">{t("Dars yo'q — «Dars qo'shish»")}</li>}
              </ul>
            )}
          </li>
        ))}
        {!r.modules.length && <li className="px-4 py-6 text-center text-v2-small text-v2-text-3">{t("Modul yo'q — «Dars qo'shish» bilan birinchi modulni yarating")}</li>}
      </ol>
      <div className="space-y-3 border-t border-v2-border p-4">
        <p className="text-v2-small text-v2-text-2">{t("Test natijasi o'quvchi kartasida va ustozga ko'rinadi. 60% dan past bo'lsa — keyingi dars ochilmaydi.")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void post({ published: !r.published }, r.published ? t("Qoralamaga qaytarildi") : t("E'lon qilindi"))} disabled={!r.published && !r.ready} className={`${r.published ? secondaryBtn : primaryBtn} disabled:opacity-50`}>
            {r.published ? t("Qoralamaga qaytarish") : t("E'lon qilish")}
          </button>
          <Link href={`/online-courses/${r.id}`} className={secondaryBtn}>
            {t("Kurs ma'lumotlari")}
          </Link>
        </div>
      </div>
    </aside>
  );
}

function LessonDialog({ r, moduleId, onClose, onDone }: { r: OnlineCourseRow; moduleId: string | null; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const NEW = "__new";
  const [mod, setMod] = useState(moduleId ?? r.modules[0]?.id ?? NEW);
  const [modName, setModName] = useState("");
  const [title, setTitle] = useState("");
  const [video, setVideo] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");
  const [test, setTest] = useState(() => String(r.modules.find((m) => m.id === mod)?.testQuestions || ""));
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function upload(f: File) {
    if (f.size > 50 * 1024 * 1024) return showError(t("Video 50 MB dan oshmasin"));
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("folder", "online-courses");
    const res = await fetch("/api/upload/video", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) return showError(t(res?.error || "Video yuklanmadi"));
    setVideo(res.url);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const s = Math.round(v.duration || 0);
      if (!s) return;
      setMin(String(Math.floor(s / 60)));
      setSec(String(s % 60));
    };
    v.src = res.url;
  }
  async function save(close: () => void) {
    const lesson = { id: "", title: title.trim(), video, minutes: Number(min) || 0, seconds: Number(sec) || 0 };
    let modules: OnlineModule[] = r.modules;
    if (mod === NEW) {
      if (!modName.trim()) return showError(t("Modul nomini yozing"));
      modules = [...modules, { id: "", name: modName.trim(), lessons: [lesson], testQuestions: Number(test) || 0 }];
    } else modules = modules.map((m) => (m.id === mod ? { ...m, lessons: [...m.lessons, lesson], testQuestions: Number(test) || 0 } : m));
    setBusy(true);
    const res = await fetch("/api/online-course-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, modules }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Dars qo'shildi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={t("Dars qo'shish")}
      subtitle={r.name}
      onClose={onClose}
      saving={busy}
      width={520}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={busy || !title.trim()} className={`${primaryBtn} disabled:opacity-50`}>
            {t("Qo'shish")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Modul")}>
          <V2Select label={t("Modul")} value={mod} onChange={(v) => (setMod(v), setTest(String(r.modules.find((m) => m.id === v)?.testQuestions || "")))} options={[...r.modules.map((m, i) => ({ value: m.id, label: `${i + 1}. ${m.name}` })), { value: NEW, label: t("+ Yangi modul") }]} searchable={false} />
        </Field>
        {mod === NEW && (
          <Field label={t("Yangi modul nomi")}>
            <TextInput value={modName} onChange={(e) => setModName(e.target.value)} placeholder={t("Masalan: Task 1 · grafiklar")} maxLength={100} />
          </Field>
        )}
        <Field label={t("Dars nomi")}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Masalan: Grafik turlari")} maxLength={120} />
        </Field>
        <Field label={t("Video")} hint={video ? t("yuklandi") : t("MP4, WEBM yoki MOV · 50 MB gacha · bo'sh qolsa — «rejada»")}>
          <button type="button" onClick={() => file.current?.click()} className={`${secondaryBtn} w-full justify-center`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} {video ? t("Boshqa video") : t("Videoni tanlang")}
          </button>
          <input ref={file} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("Daqiqa")}>
            <TextInput value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" />
          </Field>
          <Field label={t("Soniya")}>
            <TextInput value={sec} onChange={(e) => setSec(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
          </Field>
          <Field label={t("Modul testi")} hint={t("savollar soni")}>
            <TextInput value={test} onChange={(e) => setTest(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="0" />
          </Field>
        </div>
      </div>
    </V2Dialog>
  );
}

function MetaDialog({ r, onClose, onDone }: { r: OnlineCourseRow; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [teacher, setTeacher] = useState(r.teacher);
  const [aud, setAud] = useState(r.audience);
  const [busy, setBusy] = useState(false);
  async function save(close: () => void) {
    setBusy(true);
    const res = await fetch("/api/online-course-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, teacher, audience: aud }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!res?.ok) return showError(t(res?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    close();
    onDone();
  }
  return (
    <V2Dialog
      title={r.name}
      onClose={onClose}
      saving={busy}
      width={460}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} className={secondaryBtn}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void save(api.close)} disabled={busy} className={primaryBtn}>
            {t("Saqlash")}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label={t("Ustoz")}>
          <TextInput value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t("Kim uchun")} hint={t("masalan: 3/4-bosqich va IELTS guruhlari uchun")}>
          <TextInput value={aud} onChange={(e) => setAud(e.target.value)} maxLength={160} />
        </Field>
      </div>
    </V2Dialog>
  );
}
