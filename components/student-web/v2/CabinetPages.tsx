"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChartColumn,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileSignature,
  FileText,
  Gift,
  Loader2,
  LogIn,
  MessageSquare,
  Newspaper,
  Phone,
  Send,
  Wallet,
  type LucideProps,
} from "lucide-react";
import { useLang, useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { Segmented, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn } from "@/components/v2/ui/buttons";
import type { StudentMe } from "@/components/student-web/types";
import { CENTER_NAME, CENTER_PHONE } from "@/lib/center";
import type { StudentCabinet } from "@/lib/studentCabinetTypes";
import type { StudentContract } from "@/lib/studentContractTypes";
import { fmtPhone } from "./ProfileDialogV2";
import { Card, fmtSom, initials, useCabinetFmt, type CabinetTab } from "./bits";
import { chooseStudentTheme, useHtmlDark } from "./studentPrefs";

// O'QUVCHI KABINETI — 42-qism (rasmlar «Kabinet · bildirishnomalar / profil va sozlamalar / fikr bildirish»,
// «Birinchi kirish · ommaviy oferta», «Ota-ona kabineti · shartnoma»). Telegram ichidagi kabinetning ichki sahifalari:
//   • Bildirishnomalar — kabinetdagi mavjud ma'lumotdan yig'iladi (davomat, to'lov, qarz, natija, vazifa muddati,
//     yangiliklar); o'qilgani — shu qurilmada (localStorage);
//   • Profil — ma'lumotlar, ko'rinish (til, mavzu), hujjatlar (oferta, shartnomalar), yordam;
//   • Fikr bildirish — Nazorat → Fikr-mulohazaga tushadi, javob va holati shu yerda;
//   • Shartnomalar — FAQAT KO'RISH (egasi qarori: imzolash markazda);
//   • Oferta — «Kirishda tasdiq so'ralsin» yoqilsa kabinetdan oldin chiqadi.
// SMS kod bilan brauzerdan kirish — keyinroq (egasi qarori, SAVOLLAR «Reja»). Server: /api/student-web/extras.

export type SubPage = "notifications" | "profile" | "feedback" | "contracts" | "taklif" | "yangiliklar";
type Icon = ComponentType<LucideProps>;

export async function extras<T>(initData: string, body: Record<string, unknown>): Promise<(T & { ok: true }) | { ok: false; error: string }> {
  return fetch("/api/student-web/extras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ...body }) })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: "Serverga ulanib bo'lmadi" }));
}

export function SubHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  const { t } = useT();
  return (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" onClick={onBack} aria-label={t("Orqaga")} className="-ml-2 flex size-10 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2">
        <ArrowLeft className="size-5" aria-hidden />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold text-v2-text">{title}</h1>
      {action}
    </div>
  );
}

// ── Bildirishnomalar ────────────────────────────────────────────────

type NKind = "darslar" | "vazifalar" | "tolov" | "natijalar" | "yangiliklar";
interface Note {
  key: string;
  kind: NKind;
  day: string;
  time: string;
  title: string;
  text: string;
  icon: Icon;
  tone: string;
  link?: { label: string; tab: CabinetTab };
}
const SEEN_KEY = "tizimli_cabinet_seen";
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};

function buildNotes(me: StudentMe, cab: StudentCabinet, t: (s: string, v?: Record<string, string | number>) => string, monthLower: (ym: string) => string): Note[] {
  const out: Note[] = [];
  const from = new Date(Date.parse(`${cab.today}T00:00:00Z`) - 14 * 86400_000).toISOString().slice(0, 10);
  const MARK: Record<string, string> = { keldi: "Darsda qatnashdi", kechikdi: "Darsga kechikdi", birinchi: "Birinchi dars", sababli: "Sababli qoldirdi", sababsiz: "Darsni qoldirdi" };
  for (const l of cab.lessons.items) {
    if (l.date > cab.today || l.date < from) continue;
    if (l.mark) out.push({ key: `m${l.date}${l.groupId}`, kind: "darslar", day: l.date, time: l.end || l.start, title: t(MARK[l.mark] ?? l.mark), text: [l.title, l.teacher].filter(Boolean).join(" · "), icon: CalendarDays, tone: l.mark === "sababsiz" ? "bg-v2-danger-bg text-v2-danger" : "bg-v2-info-bg text-v2-info", link: { label: t("Darslar"), tab: "darslar" } });
    else if (l.date === cab.today && l.start >= cab.now) out.push({ key: `u${l.date}${l.groupId}`, kind: "darslar", day: l.date, time: l.start, title: t("Dars eslatmasi"), text: t("{g} bugun {s} da{r}", { g: l.title, s: l.start, r: l.room ? `, ${l.room}` : "" }), icon: CalendarDays, tone: "bg-v2-info-bg text-v2-info" });
  }
  for (const p of cab.payments) {
    if (p.cancelled || p.date < from) continue;
    out.push({ key: `p${p.id}`, kind: "tolov", day: p.date, time: p.time, title: t("To'lov qabul qilindi"), text: t("{s} so'm · {m} uchun", { s: fmtSom(p.amount), m: monthLower(p.periodMonth) }), icon: Wallet, tone: "bg-v2-success-bg text-v2-success", link: { label: t("To'lovlar"), tab: "tolovlar" } });
  }
  if (cab.debt.total > 0 && me.appPrefs?.showDebt !== false)
    out.push({ key: `d${cab.today}`, kind: "tolov", day: cab.today, time: "", title: t("To'lov muddati o'tgan"), text: t("Qarz: {s} so'm", { s: fmtSom(cab.debt.total) }), icon: Wallet, tone: "bg-v2-danger-bg text-v2-danger", link: { label: t("To'lovlar"), tab: "tolovlar" } });
  for (const r of cab.results) {
    if (r.date < from) continue;
    out.push({ key: `r${r.examId}`, kind: "natijalar", day: r.date, time: "", title: t("Sarhisob natijasi: {p}%", { p: r.pct }), text: t("{c} · {a} / {b} to'g'ri · guruhda {g}%", { c: r.title || r.course, a: r.correct, b: r.total, g: r.groupAvg }), icon: ChartColumn, tone: "bg-v2-brand-bg text-v2-brand", link: { label: t("Natijalar"), tab: "natijalar" } });
  }
  const week = new Date(Date.parse(`${cab.today}T00:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
  for (const tk of me.tasks) {
    const dl = (tk.deadline || "").slice(0, 10);
    if (!dl || dl < cab.today || dl > week) continue;
    out.push({ key: `t${tk.id}`, kind: "vazifalar", day: cab.today, time: "", title: t("Vazifa muddati: {d}", { d: dl.split("-").reverse().join(".") }), text: [tk.name, tk.groupName].filter(Boolean).join(" · "), icon: Check, tone: "bg-v2-warning-bg text-v2-warning" });
  }
  for (const n of me.feed?.news ?? []) {
    const d = String(n.publishAt).slice(0, 10);
    if (d < from) continue;
    out.push({ key: `n${n.id}`, kind: "yangiliklar", day: d, time: String(n.publishAt).slice(11, 16), title: n.title, text: n.body.slice(0, 120), icon: Newspaper, tone: "bg-v2-surface-2 text-v2-text-2" });
  }
  return out.sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time));
}

export function NotificationsPage({ me, cab, go, onBack }: { me: StudentMe; cab: StudentCabinet; go: (t: CabinetTab) => void; onBack: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [filter, setFilter] = useState<NKind | "all">("all");
  const [seen, setSeen] = useState(readSeen);
  const notes = useMemo(() => buildNotes(me, cab, t, fmt.monthLower), [me, cab, t, fmt.monthLower]);
  const shown = filter === "all" ? notes : notes.filter((n) => n.kind === filter);
  const kinds: { k: NKind | "all"; label: string }[] = [
    { k: "all", label: "Hammasi" },
    { k: "darslar", label: "Darslar" },
    { k: "vazifalar", label: "Vazifalar" },
    { k: "tolov", label: "To'lov" },
    { k: "natijalar", label: "Natijalar" },
    { k: "yangiliklar", label: "Yangiliklar" },
  ];
  const markAll = () => {
    const v = `${cab.today}T${cab.now}`;
    try {
      localStorage.setItem(SEEN_KEY, v);
    } catch {}
    setSeen(v);
  };
  const yesterday = new Date(Date.parse(`${cab.today}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);
  const dayLabel = (d: string) => (d === cab.today ? t("Bugun") : d === yesterday ? t("Kecha, {d}", { d: fmt.dayMonth(d) }) : fmt.dayMonth(d));
  return (
    <div>
      <SubHeader
        title={t("Bildirishnomalar")}
        onBack={onBack}
        action={
          <button type="button" onClick={markAll} aria-label={t("Hammasini o'qilgan qilish")} title={t("Hammasini o'qilgan qilish")} className="flex size-10 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2">
            <CheckCheck className="size-5" aria-hidden />
          </button>
        }
      />
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {kinds.map((k) => {
          const n = k.k === "all" ? notes.length : notes.filter((x) => x.kind === k.k).length;
          if (k.k !== "all" && !n) return null;
          const on = filter === k.k;
          return (
            <button key={k.k} type="button" onClick={() => setFilter(k.k)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-v2-full border px-3.5 text-v2-small font-semibold ${on ? "border-v2-brand bg-v2-brand text-v2-on-brand" : "border-v2-border bg-v2-surface text-v2-text"}`}>
              {t(k.label)} <span className={on ? "" : "text-v2-text-2"}>{n}</span>
            </button>
          );
        })}
      </div>
      {!shown.length ? (
        <Card>
          <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Hozircha bildirishnoma yo'q")}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
          {shown.map((n, i) => {
            const head = i === 0 || shown[i - 1].day !== n.day;
            const unread = `${n.day}T${n.time || "00:00"}` > seen;
            return (
              <div key={n.key}>
                {head && <div className="border-b border-v2-border bg-v2-surface-2 px-4 py-1.5 text-v2-caption font-semibold text-v2-text-2">{dayLabel(n.day)}</div>}
                <div className={`flex gap-3 border-b border-v2-border px-4 py-3 last:border-0 ${unread ? "bg-v2-brand-bg/30" : ""}`}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${n.tone}`}>
                    <n.icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 font-semibold text-v2-text">{n.title}</span>
                      {n.time && <span className="shrink-0 text-v2-caption tabular-nums text-v2-text-3">{n.time}</span>}
                      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-v2-brand" aria-label={t("Yangi")} />}
                    </div>
                    <div className="text-v2-small text-v2-text-2">{n.text}</div>
                    {n.link && (
                      <button type="button" onClick={() => go(n.link!.tab)} className="mt-1 inline-flex items-center gap-0.5 text-v2-small font-semibold text-v2-brand-text">
                        {n.link.label} <ChevronRight className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-center text-v2-caption text-v2-text-3">{t("Oxirgi 14 kun · muhimlari Telegram botda ham keladi")}</p>
    </div>
  );
}

/** Qo'ng'iroqcha uchun o'qilmaganlar soni. */
export function useUnreadCount(me: StudentMe, cab: StudentCabinet): number {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [seen] = useState(readSeen);
  return useMemo(() => buildNotes(me, cab, t, fmt.monthLower).filter((n) => `${n.day}T${n.time || "00:00"}` > seen).length, [me, cab, t, fmt.monthLower, seen]);
}

// ── Profil ──────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-v2-border py-2.5 last:border-0">
      <span className="shrink-0 text-v2-small text-v2-text-2">{label}</span>
      <span className="min-w-0 break-words text-right text-v2-small font-semibold text-v2-text">{value}</span>
    </div>
  );
}
function NavRow({ icon: I, title, sub, onClick, href }: { icon: Icon; title: string; sub: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
        <I className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-v2-text">{title}</span>
        <span className="block truncate text-v2-small text-v2-text-2">{sub}</span>
      </span>
      {(href || onClick) && <ChevronRight className="size-4 shrink-0 text-v2-text-3" aria-hidden />}
    </>
  );
  const cls = "flex w-full items-center gap-3 border-b border-v2-border py-2.5 last:border-0";
  if (!href && !onClick) return <div className={cls}>{inner}</div>;
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
const SectionTitle = ({ children }: { children: ReactNode }) => <h2 className="mb-1.5 mt-5 px-1 text-v2-small font-semibold text-v2-text-2">{children}</h2>;

export function ProfilePage({ me, cab, initData, open, onBack }: { me: StudentMe; cab: StudentCabinet; initData: string; open: (p: SubPage) => void; onBack: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const [lang, setLang] = useLang();
  const isDark = useHtmlDark();
  const p = me.profile;
  const [docs, setDocs] = useState<{ oferta: { done: boolean; count: number; at: string } | null; contracts: (StudentContract & { view: string })[] } | null>(null);
  useEffect(() => {
    let off = false;
    Promise.all([extras<{ sections: { id: string; required: boolean }[]; accepted: Record<string, string>; done: boolean }>(initData, { action: "oferta" }), extras<{ items: (StudentContract & { view: string })[] }>(initData, { action: "contracts" })]).then(([o, c]) => {
      if (off) return;
      const at = o.ok ? Object.values(o.accepted).sort().pop() ?? "" : "";
      setDocs({ oferta: o.ok && o.sections.length ? { done: o.done, count: o.sections.length, at } : null, contracts: c.ok ? c.items : [] });
    });
    return () => {
      off = true;
    };
  }, [initData]);
  const telHref = `tel:${CENTER_PHONE.replace(/[^\d+]/g, "")}`;
  return (
    <div>
      <SubHeader title={t("Profil")} onBack={onBack} />
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand-bg text-[18px] font-semibold text-v2-brand-text">{initials(p.fullName)}</span>
          <span className="min-w-0">
            <span className="block truncate text-[18px] font-semibold text-v2-text">{p.fullName}</span>
            {p.phone && <span className="block text-v2-small tabular-nums text-v2-text-2">{fmtPhone(p.phone)}</span>}
            <span className="block text-v2-small text-v2-text-2">{[t("{n} guruh", { n: cab.groups.length }), p.branch].filter(Boolean).join(" · ")}</span>
          </span>
        </div>
      </Card>
      <SectionTitle>{t("Shaxsiy ma'lumotlar")}</SectionTitle>
      <Card className="!py-1">
        <Row label={t("Kim sifatida")} value={p.role === "parent" ? t("Ota-ona") : t("O'quvchi")} />
        {p.birthDate && <Row label={t("Tug'ilgan kun")} value={fmt.dayMonth(p.birthDate)} />}
        {p.category && <Row label={t("Kategoriya")} value={t(p.category)} />}
        {me.addresses[0] && <Row label={t("Manzil")} value={me.addresses[0].name} />}
        <p className="py-2.5 text-v2-caption text-v2-text-3">{t("Ism va telefonni markaz o'zgartiradi — kerak bo'lsa qo'ng'iroq qiling.")}</p>
      </Card>
      <SectionTitle>{t("Ko'rinish")}</SectionTitle>
      <Card className="space-y-2">
        <Segmented
          label={t("Til")}
          value={lang}
          onChange={(v) => setLang(v as typeof lang)}
          options={[
            { value: "uz", label: "O'zbekcha" },
            { value: "uz-cyrl", label: "Ўзбекча" },
            { value: "en", label: "English" },
          ]}
        />
        <Segmented
          label={t("Mavzu")}
          value={isDark ? "dark" : "light"}
          onChange={(v) => chooseStudentTheme(v === "dark" ? "dark" : "light")}
          options={[
            { value: "light", label: t("Yorug'") },
            { value: "dark", label: t("Qorong'i") },
          ]}
        />
      </Card>
      <SectionTitle>{t("Hujjatlar")}</SectionTitle>
      <Card className="!py-1">
        {!docs ? (
          <div className="flex items-center gap-2 py-3 text-v2-small text-v2-text-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
          </div>
        ) : (
          <>
            {docs.oferta && <NavRow icon={FileText} title={t("Ommaviy oferta")} sub={docs.oferta.done ? (docs.oferta.at ? t("tanishilgan · {d}", { d: fmt.dayMonth(docs.oferta.at.slice(0, 10)) }) : t("tanishilgan")) : t("tanishilmagan")} />}
            {docs.contracts.map((c) => (
              <NavRow key={c.id} icon={FileSignature} title={t("Shartnoma · {c}", { c: c.course || c.groupLabel })} sub={`№ ${c.no} · ${c.status === "signed" ? t("imzolangan") : t("imzo kutilmoqda")}`} onClick={() => open("contracts")} />
            ))}
            {!docs.oferta && !docs.contracts.length && <p className="py-3 text-v2-small text-v2-text-3">{t("Hujjat yo'q")}</p>}
          </>
        )}
      </Card>
      <SectionTitle>{t("Yordam")}</SectionTitle>
      <Card className="!py-1">
        <NavRow icon={MessageSquare} title={t("Fikr bildirish")} sub={t("taklif, shikoyat yoki minnatdorchilik")} onClick={() => open("feedback")} />
        <NavRow icon={Gift} title={t("Taklif qilish")} sub={t("do'stingiz kelsa — referal va sovg'a")} onClick={() => open("taklif")} />
        <NavRow icon={Newspaper} title={t("Yangiliklar")} sub={t("e'lonlar va hikoyalar")} onClick={() => open("yangiliklar")} />
        <NavRow icon={Phone} title={t("Markazga qo'ng'iroq")} sub={[CENTER_PHONE, p.branch].filter(Boolean).join(" · ")} href={telHref} />
      </Card>
      <p className="mt-4 text-center text-v2-caption text-v2-text-3">{CENTER_NAME}</p>
    </div>
  );
}

// ── Fikr bildirish ──────────────────────────────────────────────────

type Fb = { id: number; type: string; about: string; izoh: string; createdAt: string; status: string; resolution: string };
const FB_STATUS: Record<string, { label: string; cls: string }> = {
  yangi: { label: "Yuborildi", cls: "bg-v2-surface-2 text-v2-text-2" },
  korib: { label: "Ko'rib chiqilmoqda", cls: "bg-v2-info-bg text-v2-info" },
  hal: { label: "Hal qilindi", cls: "bg-v2-success-bg text-v2-success" },
};

export function FeedbackPage({ me, initData, onBack }: { me: StudentMe; initData: string; onBack: () => void }) {
  const { t } = useT();
  const fmt = useCabinetFmt();
  const { showSuccess, showError } = useToast();
  const [type, setType] = useState("Taklif");
  const [about, setAbout] = useState("");
  const [text, setText] = useState("");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Fb[] | null>(null);
  useEffect(() => {
    let off = false;
    void extras<{ items: Fb[] }>(initData, { action: "feedback" }).then((r) => !off && setItems(r.ok ? r.items : []));
    return () => {
      off = true;
    };
  }, [initData]);
  const aboutOpts = [...me.groups.map((g) => `${t("Dars")} · ${g.name}`), t("Markaz"), t("Boshqa")];
  async function send() {
    if (text.trim().length < 5) return showError(t("Fikringizni yozing"));
    setBusy(true);
    const r = await extras<{ items: Fb[] }>(initData, { action: "send-feedback", type, about, izoh: text, hideName: hide });
    setBusy(false);
    if (!r.ok) return showError(t(r.error));
    setItems(r.items);
    setText("");
    showSuccess(t("Yuborildi — rahmat!"));
  }
  return (
    <div>
      <SubHeader title={t("Fikr bildirish")} onBack={onBack} />
      <Card className="space-y-3">
        <div>
          <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Turi")}</div>
          <Segmented
            label={t("Turi")}
            value={type}
            onChange={setType}
            options={[
              { value: "Taklif", label: t("Taklif") },
              { value: "Shikoyat", label: t("Shikoyat") },
              { value: "Maqtov", label: t("Minnatdorchilik") },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-v2-small font-semibold text-v2-text">{t("Nima haqida")}</div>
          <V2Select label={t("Nima haqida")} placeholder={t("Tanlang")} value={about} onChange={setAbout} options={aboutOpts.map((o) => ({ value: o, label: o }))} searchable={false} />
        </div>
        <div>
          <label htmlFor="fb-text" className="mb-1.5 block text-v2-small font-semibold text-v2-text">
            {t("Fikringiz")}
          </label>
          <textarea id="fb-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className={fieldCls("default", "h-auto py-2")} />
        </div>
        <label className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-v2-small font-semibold text-v2-text">{t("Ustozga ismim ko'rinmasin")}</span>
            <span className="block text-v2-caption text-v2-text-2">{t("rahbariyat baribir ko'radi")}</span>
          </span>
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-5 accent-[var(--v2-brand,#0f766e)]" />
        </label>
        <button type="button" disabled={busy} onClick={() => void send()} className={`${primaryBtn} h-11 w-full justify-center disabled:opacity-60`}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} {t("Yuborish")}
        </button>
        <p className="text-v2-caption text-v2-text-3">{t("Javob shu yerda ko'rinadi — odatda 2 ish kunida.")}</p>
      </Card>
      <SectionTitle>
        {t("Murojaatlarim")}
        {items ? ` · ${items.length}` : ""}
      </SectionTitle>
      <Card className="!py-1">
        {!items ? (
          <div className="flex items-center gap-2 py-3 text-v2-small text-v2-text-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
          </div>
        ) : !items.length ? (
          <p className="py-4 text-center text-v2-small text-v2-text-3">{t("Hali murojaat yo'q")}</p>
        ) : (
          items.map((f) => {
            const st = FB_STATUS[f.status] ?? FB_STATUS.yangi;
            return (
              <div key={f.id} className="border-b border-v2-border py-3 last:border-0">
                <div className="flex items-center justify-between gap-2 text-v2-caption text-v2-text-2">
                  <span>
                    {t(f.type === "Maqtov" ? "Minnatdorchilik" : f.type)} · {fmt.dayMonth(f.createdAt.slice(0, 10))}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{t(st.label)}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-v2-small font-semibold text-v2-text">{f.izoh}</div>
                {f.resolution && (
                  <div className="mt-1.5 flex gap-2 rounded-v2-md bg-v2-surface-2 px-2.5 py-1.5 text-v2-small text-v2-text-2">
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {f.resolution}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ── Shartnomalar (faqat ko'rish) ────────────────────────────────────

export function ContractsPage({ me, initData, onBack }: { me: StudentMe; initData: string; onBack: () => void }) {
  const { t } = useT();
  const [items, setItems] = useState<(StudentContract & { view: string })[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => {
    let off = false;
    void extras<{ items: (StudentContract & { view: string })[] }>(initData, { action: "contracts" }).then((r) => !off && setItems(r.ok ? r.items : []));
    return () => {
      off = true;
    };
  }, [initData]);
  const dmy = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");
  const pending = items?.filter((c) => c.status === "pending") ?? [];
  return (
    <div>
      <SubHeader title={t("Shartnomalar")} onBack={onBack} />
      <p className="-mt-2 mb-3 text-v2-small text-v2-text-2">{t("{n} · {k} ta shartnoma", { n: me.profile.fullName, k: items?.length ?? 0 })}</p>
      {pending.length > 0 && (
        <div className="mb-3 flex gap-3 rounded-v2-lg bg-v2-warning-bg p-3 text-v2-small">
          <FileSignature className="mt-0.5 size-4 shrink-0 text-v2-warning" aria-hidden />
          <span>
            <span className="block font-semibold text-v2-warning">{t("{n} ta shartnoma imzolanmagan", { n: pending.length })}</span>
            <span className="block text-v2-text-2">{t("Imzolash markazda — qulay vaqtda filialga keling yoki qo'ng'iroq qiling: {p}", { p: CENTER_PHONE })}</span>
          </span>
        </div>
      )}
      {!items ? (
        <div className="flex items-center gap-2 p-4 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      ) : !items.length ? (
        <Card>
          <p className="py-6 text-center text-v2-small text-v2-text-3">{t("Shartnoma yo'q")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const isOpen = openId === c.id;
            return (
              <Card key={c.id}>
                <button type="button" onClick={() => setOpenId(isOpen ? null : c.id)} className="flex w-full items-start gap-3 text-left" aria-expanded={isOpen}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${c.status === "signed" ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>
                    <FileSignature className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-v2-text">{t("O'quv xizmatlari ko'rsatish shartnomasi")}</span>
                    <span className="block text-v2-small text-v2-text-2">
                      № {c.no} · {c.course || c.groupLabel}
                    </span>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-v2-caption font-semibold ${c.status === "signed" ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}>{c.status === "signed" ? t("imzolangan") : t("imzo kutilmoqda")}</span>
                  </span>
                  <ChevronDown className={`mt-1 size-4 shrink-0 text-v2-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="mt-3 rounded-v2-md border border-v2-border px-3 py-1">
                    <Row label={t("Markaz")} value={CENTER_NAME} />
                    <Row label={t("Imzolovchi")} value={`${c.signerName} · ${t(c.signerRelation)}`} />
                    <Row label={t("O'quvchi")} value={c.pupilName} />
                    <Row label={t("Kurs")} value={c.groupLabel || c.course} />
                    <Row label={t("Oylik narx")} value={`${fmtSom(c.price)} ${t("so'm")}`} />
                    <Row label={t("Amal qilish")} value={`${dmy(c.from)} – ${dmy(c.to)}`} />
                    {c.signedAt && <Row label={t("Imzolangan")} value={`${dmy(c.signedAt)}${c.signedVia ? ` · ${t(c.signedVia)}` : ""}`} />}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-center text-v2-caption text-v2-text-3">{t("Shartnoma matni va nusxasi — markazda. Savol bo'lsa: {p}", { p: CENTER_PHONE })}</p>
    </div>
  );
}

// ── Oferta (kirishda) ───────────────────────────────────────────────

type OfertaState = { gate: boolean; sections: { id: string; title: string; text: string; required: boolean }[]; accepted: Record<string, string>; missing: string[]; done: boolean };

/** Kabinet ochilishidan oldin: «Kirishda tasdiq so'ralsin» yoqilgan va majburiy bo'lim qolgan bo'lsa — oferta oynasi. */
export function useOfertaGate(initData: string, enabled: boolean) {
  const [st, setSt] = useState<OfertaState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let off = false;
    void extras<OfertaState>(initData, { action: "oferta" }).then((r) => !off && r.ok && setSt(r));
    return () => {
      off = true;
    };
  }, [initData, enabled]);
  return { state: enabled ? st : null, setState: setSt, loading: enabled && !st };
}

export function OfertaGate({ state, initData, onDone }: { state: OfertaState; initData: string; onDone: (s: OfertaState) => void }) {
  const { t } = useT();
  const { showError } = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(state.accepted).map((k) => [k, true])));
  const [openId, setOpenId] = useState<string | null>(state.missing[0] ?? null);
  const [busy, setBusy] = useState(false);
  const req = state.sections.filter((s) => s.required);
  const opt = state.sections.length - req.length;
  const doneN = req.filter((s) => checked[s.id]).length;
  const left = req.length - doneN;
  async function enter() {
    setBusy(true);
    const r = await extras<OfertaState>(initData, { action: "accept-oferta", ids: Object.keys(checked).filter((k) => checked[k]) });
    setBusy(false);
    if (!r.ok) return showError(t(r.error));
    onDone(r);
  }
  return (
    <div data-ui="v2" className="min-h-dvh bg-v2-bg font-v2 text-v2-text">
      <div className="mx-auto max-w-[560px] px-4 pb-32 pt-5">
        <h1 className="text-[22px] font-semibold text-v2-text">{t("Ommaviy oferta")}</h1>
        <p className="mt-1 text-v2-small text-v2-text-2">{t("Kirish uchun majburiy bo'limlarni o'qib, «Tanishdim» deb belgilang.")}</p>
        <div className="mt-3 flex justify-between text-v2-small">
          <span className="font-semibold text-v2-text">{t("{a} / {b} tanishildi", { a: doneN, b: req.length })}</span>
          {opt > 0 && <span className="text-v2-text-3">{t("+{n} ixtiyoriy", { n: opt })}</span>}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
          <div className="h-full rounded-full bg-v2-success" style={{ width: `${req.length ? (doneN / req.length) * 100 : 100}%` }} />
        </div>
        <div className="mt-4 space-y-2">
          {state.sections.map((s, i) => {
            const on = !!checked[s.id];
            const isOpen = openId === s.id;
            return (
              <div key={s.id} className={`rounded-v2-lg border bg-v2-surface ${isOpen ? "border-v2-brand" : "border-v2-border"}`}>
                <button type="button" onClick={() => setOpenId(isOpen ? null : s.id)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={isOpen}>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-v2-small font-semibold ${on ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>{on ? <Check className="size-4" aria-hidden /> : i + 1}</span>
                  <span className="min-w-0 flex-1 font-semibold text-v2-text">{s.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-v2-caption font-semibold ${on ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2"}`}>{on ? t("Tanishdim") : s.required ? t("majburiy") : t("ixtiyoriy")}</span>
                  <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pl-14">
                    <p className="whitespace-pre-line text-v2-small leading-6 text-v2-text">{s.text || t("Matn kiritilmagan")}</p>
                    <label className="mt-3 flex items-center gap-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
                      <span className="min-w-0 flex-1 text-v2-small font-semibold text-v2-text">{t("O'qidim, tanishdim")}</span>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          setChecked({ ...checked, [s.id]: e.target.checked });
                          if (e.target.checked) setOpenId(state.sections.find((x, j) => j > i && !checked[x.id])?.id ?? null);
                        }}
                        className="size-5 accent-[var(--v2-brand,#0f766e)]"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-v2-border bg-v2-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-[560px]">
          {left > 0 && <p className="mb-2 text-center text-v2-caption text-v2-text-2">{t("Yana {n} ta majburiy bo'lim qoldi", { n: left })}</p>}
          <button type="button" disabled={left > 0 || busy} onClick={() => void enter()} className={`${primaryBtn} h-12 w-full justify-center disabled:opacity-50`}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogIn className="size-4" aria-hidden />} {t("Kabinetga kirish")}
          </button>
        </div>
      </div>
    </div>
  );
}
