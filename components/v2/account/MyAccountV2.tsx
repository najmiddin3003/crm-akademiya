"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Globe, KeyRound, Laptop, Loader2, Lock, LogOut, Monitor, Moon, Phone, Send, Shield, Smartphone, Sun, Upload, User } from "lucide-react";
import Link from "@/components/ui/Link";
import { setLang, useT } from "@/components/shared/Language";
import { setTheme, useTheme } from "@/components/shared/Theme";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/v2/form/PasswordInput";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { Field, Segmented, TextInput } from "@/components/v2/form/fields";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { NoticeBar, PageShell, TH } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { AUTO_LOCK_OPTIONS, type AccountPrefs, type MyAccount } from "@/lib/myAccountTypes";

// YANGI VERSIYA — «MENING HISOBIM» (37-qism, rasmlar «Profil», «Xavfsizlik», «Qurilmalar»). Profil (shaxsiy
// ma'lumotlar, rasm, kirish va aloqa, «Boshqalar sizni shunday ko'radi», Ko'rinish), Xavfsizlik (parol yoshi, parolni
// almashtirish kuch o'lchagichi bilan, ekran qulfi, faol qurilmalar, so'nggi kirishlar), Qurilmalar (ochiq seanslar,
// chiqarish). /settings-profile, /settings-security, /settings-devices — bitta sahifa, tab manzildan.
// Server: /api/my-account (lib/myAccount.ts), /api/auth/change-password, /api/sessions, /api/auth/lock.

export type AccountTab = "profile" | "security" | "devices";
const TABS: { key: AccountTab; href: string; label: string; Icon: typeof User }[] = [
  { key: "profile", href: "/settings-profile", label: "Profil", Icon: User },
  { key: "security", href: "/settings-security", label: "Xavfsizlik", Icon: Shield },
  { key: "devices", href: "/settings-devices", label: "Qurilmalar", Icon: Monitor },
];
const initialsOf = (a: string, b: string) => `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase() || "?";
const daysSince = (iso: string | null) => (iso ? Math.floor((Date.parse(new Date().toISOString()) - Date.parse(iso)) / 86_400_000) : null);
const uzStamp = (iso: string) => {
  const d = new Date(Date.parse(iso) + 5 * 3600_000).toISOString();
  return { day: d.slice(0, 10), hm: d.slice(11, 16) };
};
const isMobile = (label: string) => /Android|iOS/.test(label);

export default function MyAccountV2({ tab }: { tab: AccountTab }) {
  const { t } = useT();
  const { data: d, error, reload } = useReportData<MyAccount>("/api/my-account");
  return (
    <PageShell flow>
      {d ? (
        <div className="flex items-center gap-4">
          <AvatarBig a={d} size="size-14 text-[20px]" />
          <div className="min-w-0">
            <h1 className="text-v2-page text-v2-text">{t("Mening hisobim")}</h1>
            <p className="truncate text-v2-small text-v2-text-2">{[`${d.firstName} ${d.lastName}`.trim(), t(d.roleLabel), t("bu sahifani faqat siz ko'rasiz")].join(" · ")}</p>
          </div>
        </div>
      ) : (
        <h1 className="text-v2-page text-v2-text">{t("Mening hisobim")}</h1>
      )}
      <nav className="-mb-1 flex gap-1 overflow-x-auto border-b border-v2-border" aria-label={t("Mening hisobim")}>
        {TABS.map((x) => (
          <Link key={x.key} href={x.href} aria-current={tab === x.key ? "page" : undefined} className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-v2-body ${tab === x.key ? "border-v2-brand font-semibold text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"}`}>
            <x.Icon className="size-4" strokeWidth={1.75} aria-hidden /> {t(x.label)}
            {x.key === "devices" && d && <span className="rounded-full bg-v2-surface-2 px-1.5 text-v2-caption font-semibold">{d.sessions.length}</span>}
          </Link>
        ))}
      </nav>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && tab === "profile" && <ProfileTab key={d.updatedAt ?? "p"} d={d} onSaved={reload} />}
      {d && tab === "security" && <SecurityTab d={d} onSaved={reload} />}
      {d && tab === "devices" && <DevicesTab d={d} onChange={reload} />}
    </PageShell>
  );
}

function AvatarBig({ a, size, src }: { a: Pick<MyAccount, "firstName" | "lastName" | "avatar">; size: string; src?: string }) {
  const url = src ?? a.avatar;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- yuklangan rasm (Cloudinary)
    <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-v2-brand font-semibold text-white`}>{initialsOf(a.firstName, a.lastName)}</span>
  );
}

function Card({ title, sub, children, action, className = "" }: { title: ReactNode; sub?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-v2-text">{title}</h2>
          {sub && <p className="text-v2-small text-v2-text-2">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const Taklif = () => {
  const { t } = useT();
  return <span className="ml-1 rounded-v2-sm bg-v2-violet-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-violet">{t("Tez orada")}</span>;
};

// ─────────────────────────────── Profil ───────────────────────────────

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

function ProfileTab({ d, onSaved }: { d: MyAccount; onSaved: () => void }) {
  const { t, lang, months } = useT();
  const fmt = useProfileFmt();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [isDark] = useTheme();
  const [first, setFirst] = useState(d.firstName);
  const [last, setLast] = useState(d.lastName);
  const [middle, setMiddle] = useState(d.middleName);
  const [bm, setBm] = useState(d.birthday.slice(0, 2));
  const [bd, setBd] = useState(d.birthday.slice(3, 5));
  const [email, setEmail] = useState(d.email);
  const [avatar, setAvatar] = useState(d.avatar);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<AccountPrefs>(d.prefs);
  const [unlink, setUnlink] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = first !== d.firstName || last !== d.lastName || middle !== d.middleName || `${bm}-${bd}` !== (d.birthday || "-") || email !== d.email || avatar !== d.avatar;
  const shortName = `${first} ${last[0] ? `${last[0]}.` : ""}`.trim();

  async function upload(f: File) {
    if (f.size > 5 * 1024 * 1024) return showError(t("Rasm hajmi 5 MB dan oshmasin"));
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("folder", "avatars");
    const r = await fetch("/api/upload/image", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Rasm yuklanmadi"));
    setAvatar(r.url);
  }
  async function post(body: Record<string, unknown>) {
    return fetch("/api/my-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json())
      .catch(() => null);
  }
  async function save() {
    setBusy(true);
    const r = await post({ action: "profile", firstName: first, lastName: last, middleName: middle, birthday: bm && bd ? `${bm}-${bd.padStart(2, "0")}` : "", email, avatar });
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Profil saqlandi"));
    onSaved();
    router.refresh();
  }
  async function pref(p: Partial<AccountPrefs>) {
    setPrefs((x) => ({ ...x, ...p }));
    const r = await post({ action: "prefs", prefs: p });
    if (!r?.ok) showError(t("Saqlab bo'lmadi"));
  }
  const dayOpts = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1) }));

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card title={t("Shaxsiy ma'lumotlar")} sub={t("Xodimlar ro'yxati, chek va amallar jurnalida shu ism chiqadi")}>
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <AvatarBig a={d} src={avatar} size="size-[72px] text-[24px]" />
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => file.current?.click()} disabled={busy} className={secondaryBtn}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />} {t("Rasm yuklash")}
                </button>
                {avatar && (
                  <button type="button" onClick={() => setAvatar("")} className={`${secondaryBtn} border-transparent shadow-none text-v2-danger`}>
                    {t("Olib tashlash")}
                  </button>
                )}
              </div>
              <p className="text-v2-small text-v2-text-2">{t("JPG yoki PNG · kvadrat · 5 MB gacha. Rasm bo'lmasa — ism-familiya harflari.")}</p>
            </div>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Ism")}>
              <TextInput value={first} onChange={(e) => setFirst(e.target.value)} maxLength={40} />
            </Field>
            <Field label={t("Familiya")}>
              <TextInput value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} />
            </Field>
            <Field label={t("Otasining ismi")} optional>
              <TextInput value={middle} onChange={(e) => setMiddle(e.target.value)} placeholder={t("Masalan: Rustamovich")} maxLength={60} />
            </Field>
            <Field label={t("Tug'ilgan kun")} optional hint={t("Jamoa tabrigi uchun · yil ko'rsatilmaydi")}>
              <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                <V2Select label={t("Kun")} value={bd} onChange={setBd} options={dayOpts} placeholder="—" searchable={false} />
                <V2Select label={t("Oy")} value={bm} onChange={setBm} options={MONTHS.map((m, i) => ({ value: m, label: months[i] }))} placeholder="—" searchable={false} />
              </div>
            </Field>
          </div>
          <Field label={t("Lavozim")} className="mt-4" hint={t("Lavozim va huquqlarni faqat «Boshqaruv → Rollar» o'zgartiradi — bu yerda emas.")}>
            <div className="flex items-center gap-2 rounded-v2-md border border-dashed border-v2-border-strong bg-v2-surface-2 px-3 py-2.5 text-v2-body">
              <Lock className="size-4 text-v2-text-3" aria-hidden />
              <span className="flex-1 text-v2-text">
                {t(d.roleLabel)} · {d.branchesLabel}
              </span>
              <Link href="/management-rollar" className="text-v2-small font-semibold text-v2-brand">
                {t("Rollar va huquqlar")}
              </Link>
            </div>
          </Field>
        </Card>

        <Card title={t("Kirish va aloqa")} sub={t("Telefon — login. Telegram — muhim xabarlar va kassa ishlari uchun")}>
          <div className="space-y-4">
            <Field label={t("Telefon raqam · login")} hint={t("Raqamni almashtirish — direktor orqali (Boshqaruv → Xodimlar)")}>
              <div className="flex items-center gap-2 rounded-v2-md border border-v2-border-strong px-3 py-2.5">
                <Phone className="size-4 text-v2-text-2" aria-hidden />
                <span className="flex-1 tabular-nums text-v2-text">+{d.phone.replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">
                  <span className="size-1.5 rounded-full bg-current" /> {t("Tasdiqlangan")}
                </span>
              </div>
            </Field>
            <Field label="Telegram" hint={t("Xodim boti: kassa kirim-chiqimi, topshiriqlar va eslatmalar shu yerga keladi.")}>
              <div className="flex items-center gap-2 rounded-v2-md border border-v2-border-strong px-3 py-2.5">
                <Send className="size-4 text-v2-text-2" aria-hidden />
                {d.telegram.linked ? (
                  <>
                    <span className="flex-1 text-v2-text">
                      <b>{t("Ulangan")}</b> <span className="text-v2-text-2">· {[d.telegram.name, d.telegram.since && t("{d} dan", { d: d.telegram.since.slice(0, 10) })].filter(Boolean).join(" · ")}</span>
                    </span>
                    <button type="button" onClick={() => setUnlink(true)} className="text-v2-small font-semibold text-v2-danger">
                      {t("Uzish")}
                    </button>
                  </>
                ) : (
                  <span className="flex-1 text-v2-text-2">{t("Ulanmagan — xodim botiga telefon va parol bilan kiring")}</span>
                )}
              </div>
            </Field>
            <Field label={t("Elektron pochta")} optional>
              <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@pochta.uz" maxLength={120} />
            </Field>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="mr-auto text-v2-small text-v2-text-2">
            {[d.createdAt && t("Hisob yaratilgan: {d}", { d: ((x: string) => (x.includes(d.createdAt!.slice(0, 4)) ? x : `${x} ${d.createdAt!.slice(0, 4)}`))(fmt.dayMonth(d.createdAt.slice(0, 10))) }), d.updatedAt && t("oxirgi o'zgarish: {d}", { d: fmt.dayMonth(d.updatedAt.slice(0, 10)) })].filter(Boolean).join(" · ")}
          </span>
          {dirty && (
            <button type="button" onClick={() => (setFirst(d.firstName), setLast(d.lastName), setMiddle(d.middleName), setBm(d.birthday.slice(0, 2)), setBd(d.birthday.slice(3, 5)), setEmail(d.email), setAvatar(d.avatar))} className={secondaryBtn}>
              {t("Bekor qilish")}
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={!dirty || busy} className={`${primaryBtn} disabled:opacity-50`}>
            <Check className="size-4" aria-hidden /> {t("Saqlash")}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Card title={t("Boshqalar sizni shunday ko'radi")} sub={t("Ism va rasm 3 ta joyda chiqadi")}>
          <div className="space-y-3 text-v2-small">
            <div>
              <div className="mb-1 font-semibold text-v2-text-2">{t("Xodimlar ro'yxati")}</div>
              <div className="flex items-center gap-3 rounded-v2-md border border-v2-border p-3">
                <AvatarBig a={d} src={avatar} size="size-9 text-v2-small" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-v2-text">{`${first} ${last}`.trim() || "—"}</div>
                  <div className="text-v2-caption text-v2-text-2">{t(d.roleLabel)}</div>
                </div>
                <span className="rounded-full bg-v2-brand-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-brand">{t("{n} filial", { n: d.branchCount })}</span>
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold text-v2-text-2">{t("Chekda")}</div>
              <div className="flex justify-between rounded-v2-md border border-dashed border-v2-border-strong p-3">
                <span className="text-v2-text-2">{t("Qabul qildi")}</span>
                <b className="text-v2-text">{shortName || "—"}</b>
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold text-v2-text-2">{t("Amallar jurnalida")}</div>
              <div className="rounded-v2-md border border-v2-border p-3 text-v2-text">
                <span className="text-v2-text-3">10:14</span> <b>{shortName || "—"}</b> {t("guruhni tahrirladi")}
              </div>
            </div>
          </div>
        </Card>
        <Card title={t("Ko'rinish")} sub={t("Faqat sizning ekraningizda")}>
          <div className="space-y-4">
            <Field label={t("Til")}>
              <Segmented
                label={t("Til")}
                value={lang}
                onChange={(v) => setLang(v as never)}
                options={[
                  { value: "uz", label: "O'zbekcha" },
                  { value: "uz-cyrl", label: "Ўзбекча" },
                  { value: "en", label: "English" },
                ]}
              />
            </Field>
            <Field label={t("Mavzu")}>
              <div role="radiogroup" aria-label={t("Mavzu")} className="flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
                {(
                  [
                    ["light", t("Yorug'"), Sun],
                    ["dark", t("Qorong'i"), Moon],
                  ] as const
                ).map(([v, l, I]) => (
                  <button key={v} type="button" role="radio" aria-checked={(v === "dark") === isDark} onClick={() => setTheme(v)} className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-v2-sm text-v2-small font-semibold ${(v === "dark") === isDark ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-2"}`}>
                    <I className="size-4" aria-hidden /> {l}
                  </button>
                ))}
              </div>
            </Field>
            {d.branches.length > 1 && (
              <Field label={t("Kirgandan keyin ochiladi")} hint={t("{n} ta filial — har safar tanlash shart emas", { n: d.branches.length })}>
                <V2Select
                  label={t("Kirgandan keyin ochiladi")}
                  value={prefs.startBranch}
                  onChange={(v) => void pref({ startBranch: v })}
                  searchable={false}
                  options={[{ value: "last", label: t("Oxirgi tanlangan filial") }, { value: "ask", label: t("Har safar so'rasin") }, ...d.branches.map((b) => ({ value: String(b.id), label: b.name }))]}
                />
              </Field>
            )}
            <Field label={t("Jadval filtrlari")}>
              <Segmented
                label={t("Jadval filtrlari")}
                value={prefs.filterMode}
                onChange={(v) => void pref({ filterMode: v as AccountPrefs["filterMode"] })}
                options={[
                  { value: "button", label: t("Tugmada") },
                  { value: "inline", label: t("Bitta ro'yxat") },
                  { value: "separate", label: t("Alohida") },
                ]}
              />
            </Field>
            <div className="flex items-center justify-between gap-3 text-v2-small text-v2-text">
              {t("Filtrlar ochiq tursin")}
              <Switch on={prefs.filtersOpen} label={t("Filtrlar ochiq tursin")} onChange={(v) => void pref({ filtersOpen: v })} />
            </div>
          </div>
        </Card>
      </div>
      {unlink && (
        <V2Confirm
          title={t("Telegramni uzish")}
          body={t("Xodim botidagi kirish yopiladi. Qayta ulash — botda telefon va parol bilan kirish.")}
          confirmLabel={t("Uzish")}
          onConfirm={async () => {
            setUnlink(false);
            const r = await post({ action: "unlink-telegram" });
            if (!r?.ok) return showError(t("Saqlab bo'lmadi"));
            showSuccess(t("Telegram uzildi"));
            onSaved();
          }}
          onCancel={() => setUnlink(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────── Xavfsizlik ───────────────────────────────

function strength(p: string, phone: string) {
  const checks = {
    len: p.length >= 8,
    mix: /[a-zA-Z]/.test(p) && /\d/.test(p),
    phone: !!p && !phone.endsWith(p.replace(/\D/g, "")) && !p.includes(phone.slice(-7)),
    sym: /[^a-zA-Z0-9]/.test(p),
  };
  const score = (checks.len ? 1 : 0) + (checks.mix ? 1 : 0) + (checks.phone && p.length >= 6 ? 1 : 0) + (checks.sym ? 1 : 0);
  return { checks, score };
}

function Check1({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${on ? "text-v2-text" : "text-v2-text-3"}`}>
      {on ? <Check className="size-3.5 text-v2-success" aria-hidden /> : <span className="mx-1 size-1.5 rounded-full bg-current" aria-hidden />} {children}
    </li>
  );
}

function SecurityTab({ d, onSaved }: { d: MyAccount; onSaved: () => void }) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autoLock, setAutoLock] = useState(String(d.prefs.autoLockMin));
  const age = daysSince(d.passwordUpdatedAt ?? d.createdAt);
  const s = strength(p1, d.phone);
  const label = ["", t("Juda zaif"), t("Zaif"), t("Yaxshi"), t("Kuchli")][s.score] ?? "";
  const color = s.score >= 4 ? "bg-v2-success" : s.score >= 3 ? "bg-v2-info" : s.score >= 2 ? "bg-v2-warning" : "bg-v2-danger";
  const otherCount = d.sessions.filter((x) => !x.current).length;
  const ok = s.checks.len && s.checks.mix && s.checks.phone && p1 === p2 && !!cur;

  async function change() {
    setBusy(true);
    const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: cur, new_password: p1, logout_others: others }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Parol almashmadi"));
    showSuccess(t("Parol almashtirildi"));
    setCur("");
    setP1("");
    setP2("");
    onSaved();
  }
  async function lockNow() {
    await fetch("/api/auth/lock", { method: "POST" }).catch(() => null);
    router.push("/lock");
  }
  async function saveLock(v: string) {
    setAutoLock(v);
    const r = await fetch("/api/my-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", prefs: { autoLockMin: Number(v) } }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t("Saqlab bo'lmadi"));
    showSuccess(Number(v) ? t("Avtomatik qulf yoqildi") : t("Avtomatik qulf o'chirildi"));
    router.refresh();
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini Icon={KeyRound} tone={age !== null && age > 90 ? "warning" : "success"} label={t("Parol")} value={age === null ? "—" : age === 0 ? t("bugun") : t("{n} kun oldin", { n: age })} sub={age !== null && age > 90 ? t("90 kundan oshdi — almashtiring") : t("almashtirilgan")} />
        <Mini Icon={Shield} tone="neutral" label={t("Ikki bosqichli kirish")} value={t("Tez orada")} sub={t("Telegram kod bilan")} />
        <Mini Icon={Lock} tone="success" label={t("Ekran qulfi")} value={Number(autoLock) ? t("{n} daqiqada", { n: autoLock }) : t("O'chiq")} sub={t("harakatsizlikdan keyin o'zi")} />
        <Mini Icon={Monitor} tone="success" label={t("Faol qurilmalar")} value={t("{n} ta", { n: d.sessions.length })} sub={t("hammasi sizniki?")} />
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title={
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-warning-bg text-v2-warning">
                <KeyRound className="size-4" aria-hidden />
              </span>
              {t("Parolni o'zgartirish")}
            </span>
          }
          sub={d.passwordUpdatedAt ? t("Oxirgi marta {d} kuni o'zgartirilgan", { d: fmt.dayMonth(d.passwordUpdatedAt.slice(0, 10)) }) : undefined}
        >
          <div className="space-y-4">
            <Field label={t("Joriy parol")} htmlFor="cur-pass">
              <PasswordInput id="cur-pass" value={cur} onChange={setCur} autoComplete="current-password" />
            </Field>
            <Field label={t("Yangi parol")} htmlFor="new-pass">
              <PasswordInput id="new-pass" value={p1} onChange={setP1} autoComplete="new-password" />
              {p1 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 rounded-full ${i <= s.score ? color : "bg-v2-surface-2"}`} />
                    ))}
                  </div>
                  <span className="text-v2-small font-semibold text-v2-text">{label}</span>
                </div>
              )}
              <ul className="mt-2 grid gap-1 text-v2-small sm:grid-cols-2">
                <Check1 on={s.checks.len}>{t("Kamida 8 belgi")}</Check1>
                <Check1 on={s.checks.mix}>{t("Harf va raqam bor")}</Check1>
                <Check1 on={!!p1 && s.checks.phone}>{t("Telefon raqamingiz emas")}</Check1>
                <Check1 on={s.checks.sym}>{t("Belgi (! # -) qo'shsangiz — yanada kuchli")}</Check1>
              </ul>
            </Field>
            <Field label={t("Yangi parolni takrorlang")} htmlFor="new-pass2" error={p2 && p1 !== p2 ? t("Mos kelmadi") : undefined} hint={p2 && p1 === p2 ? t("Mos keladi") : undefined}>
              <PasswordInput id="new-pass2" value={p2} onChange={setP2} autoComplete="new-password" state={p2 && p1 !== p2 ? "error" : "default"} />
            </Field>
            {otherCount > 0 && (
              <label className="flex items-start gap-2 text-v2-small text-v2-text">
                <V2Checkbox checked={others} onChange={setOthers} label={t("Boshqa qurilmalardan chiqarish")} />
                <span>
                  <b>{t("Boshqa {n} ta qurilmadan chiqarish", { n: otherCount })}</b>
                  <span className="block text-v2-text-2">{t("Parolni kimdir bilgan bo'lsa — u darhol chiqariladi. Shu qurilmada qolasiz.")}</span>
                </span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void change()} disabled={!ok || busy} className={`${primaryBtn} disabled:opacity-50`}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} {t("Parolni o'zgartirish")}
              </button>
              <span className="text-v2-small text-v2-text-2">{t("Parolni unutsangiz — kirish sahifasida «Parolni unutdim?» SMS kod bilan tiklaydi")}</span>
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card
            title={t("Ekran qulfi")}
            sub={t("Joyingizdan turganda — boshqalar ko'rmasin")}
            action={
              <button type="button" onClick={() => void lockNow()} className={secondaryBtn}>
                <Lock className="size-4" aria-hidden /> {t("Hozir qulflash")}
              </button>
            }
          >
            <Field label={t("Avtomatik qulflash")} hint={t("Ochiq oyna saqlanib turadi · ochish — parol bilan")}>
              <V2Select label={t("Avtomatik qulflash")} value={autoLock} onChange={(v) => void saveLock(v)} searchable={false} options={AUTO_LOCK_OPTIONS.map((m) => ({ value: String(m), label: m ? t("{n} daqiqa harakatsizlikdan keyin", { n: m }) : t("O'chiq") }))} />
            </Field>
          </Card>
          <Card
            title={t("Faol qurilmalar")}
            sub={t("{n} ta", { n: d.sessions.length })}
            action={
              <Link href="/settings-devices" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("Hammasi")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            <ul className="divide-y divide-v2-border">
              {d.sessions.slice(0, 3).map((x) => (
                <li key={x.sid} className="flex items-center gap-3 py-2.5">
                  <DeviceIcon label={x.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold text-v2-text">
                      <span className="truncate">{x.label}</span>
                      {x.current && <span className="shrink-0 rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption text-v2-success">{t("Shu qurilma")}</span>}
                    </div>
                    <div className="text-v2-small text-v2-text-2">{x.current ? t("hozir faol") : x.lastSeenAt}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            title={t("So'nggi kirishlar")}
            sub={t("Xato urinishlar ham yoziladi")}
            action={
              <Link href="/action-log" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("Jurnal")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            <ul className="space-y-3">
              {d.logins.map((l, i) => {
                const st = uzStamp(l.at);
                return (
                  <li key={i} className="flex gap-2.5">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${l.ok ? "bg-v2-success" : "bg-v2-danger"}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-v2-small">
                        <b className="truncate text-v2-text">{l.device}</b>
                        <span className="shrink-0 tabular-nums text-v2-text-2">
                          {fmt.dayMonth(st.day)} | {st.hm}
                        </span>
                      </div>
                      <div className={`text-v2-caption ${l.ok ? "text-v2-text-2" : "text-v2-danger"}`}>{l.ok ? t("Kirdi · {ip}", { ip: l.ip }) : t("Kira olmadi · {r}", { r: t(l.reason || "xato parol") })}</div>
                    </div>
                  </li>
                );
              })}
              {!d.logins.length && <li className="text-v2-small text-v2-text-3">{t("Yozuv yo'q")}</li>}
            </ul>
          </Card>
        </div>
      </div>
      <Card
        title={
          <span className="flex items-center">
            {t("Ikki bosqichli kirish")} <Taklif />
          </span>
        }
        sub={t("Yangi qurilmadan kirganda paroldan keyin 6 xonali kod so'raladi (Telegram yoki SMS). Hali ishga tushmagan.")}
        className="opacity-80"
      >
        <span />
      </Card>
    </>
  );
}

function Mini({ Icon, label, value, sub, tone }: { Icon: typeof Lock; label: string; value: string; sub: string; tone: "success" | "warning" | "neutral" }) {
  const c = tone === "warning" ? "bg-v2-warning-bg text-v2-warning" : tone === "success" ? "bg-v2-success-bg text-v2-success" : "bg-v2-surface-2 text-v2-text-2";
  return (
    <div className="flex gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-3 shadow-v2-sm sm:p-4">
      <span className={`hidden size-9 sm:flex shrink-0 items-center justify-center rounded-v2-md ${c}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-v2-small text-v2-text-2">{label}</div>
        <div className={`font-semibold ${tone === "warning" ? "text-v2-warning" : "text-v2-text"}`}>{value}</div>
        <div className="truncate text-v2-small text-v2-text-2">{sub}</div>
      </div>
    </div>
  );
}

function DeviceIcon({ label }: { label: string }) {
  const I = isMobile(label) ? Smartphone : /Windows|macOS|Linux/.test(label) ? Laptop : Globe;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface-2 text-v2-text-2">
      <I className="size-4" aria-hidden />
    </span>
  );
}

// ─────────────────────────────── Qurilmalar ───────────────────────────────

function DevicesTab({ d, onChange }: { d: MyAccount; onChange: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [ask, setAsk] = useState<"all" | string | null>(null);
  async function out(sid: string | "all") {
    const r = await fetch(`/api/sessions?${sid === "all" ? "all=1" : `sid=${encodeURIComponent(sid)}`}`, { method: "DELETE" })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) return showError(t(r?.error || "Chiqarib bo'lmadi"));
    if (r.wasCurrent) return router.push("/");
    showSuccess(sid === "all" ? t("{n} ta qurilmadan chiqarildi", { n: r.deleted }) : t("Qurilma chiqarildi"));
    onChange();
  }
  const others = d.sessions.filter((x) => !x.current).length;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-v2-text">{t("Hisobingiz {n} ta qurilmada ochiq", { n: d.sessions.length })}</h2>
          <p className="text-v2-small text-v2-text-2">{t("Har kirish alohida qurilma bo'lib yoziladi; chiqarilgan qurilma keyingi bosishda kirish sahifasiga qaytadi")}</p>
        </div>
        <button type="button" onClick={() => setAsk("all")} disabled={!others} className={`${secondaryBtn} border-v2-danger text-v2-danger disabled:opacity-50`}>
          <LogOut className="size-4" aria-hidden /> {t("Boshqa qurilmalardan chiqish")}
        </button>
      </div>
      <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-v2-body">
            <thead>
              <tr className="border-b border-v2-border bg-v2-surface-2 text-left">
                <th className={`${TH} pl-4`}>{t("Qurilma")}</th>
                <th className={TH}>{t("IP manzil")}</th>
                <th className={TH}>{t("Kirgan")}</th>
                <th className={TH}>{t("Oxirgi faollik")}</th>
                <th className={`${TH} pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.sessions.map((x) => (
                <tr key={x.sid} className="border-b border-v2-border last:border-b-0">
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <DeviceIcon label={x.label} />
                      <span className="font-semibold text-v2-text">{x.label}</span>
                      {x.current && <span className="rounded-full bg-v2-success-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-success">{t("Shu qurilma")}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-v2-text-2">{x.ip || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-v2-text">{x.createdAt}</td>
                  <td className="px-3 py-2.5 tabular-nums text-v2-text">{x.current ? <span className="text-v2-success">{t("hozir")}</span> : x.lastSeenAt}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right">
                    {!x.current && (
                      <button type="button" onClick={() => setAsk(x.sid)} className="text-v2-small font-semibold text-v2-danger">
                        {t("Chiqarish")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-danger-bg text-v2-danger">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              {t("Notanish qurilma ko'rsangiz")}
            </span>
          }
          sub={t("3 qadam · 1 daqiqa")}
        >
          <ol className="space-y-3 text-v2-small">
            {[
              [t("Shu qurilmani chiqaring"), t("Qatordagi «Chiqarish» — seans darhol yopiladi")],
              [t("Parolni almashtiring"), t("Xavfsizlik → Parolni o'zgartirish")],
              [t("Direktorga xabar bering"), t("Amallar jurnalida shu qurilmadan nima qilingani ko'rinadi")],
            ].map(([a, b], i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-v2-danger-bg text-v2-caption font-semibold text-v2-danger">{i + 1}</span>
                <span>
                  <b className="block text-v2-text">{a}</b>
                  <span className="text-v2-text-2">{b}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card
          title={
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-v2-md bg-v2-info-bg text-v2-info">
                <Globe className="size-4" aria-hidden />
              </span>
              {t("Qurilma qanday aniqlanadi")}
            </span>
          }
          sub={t("Brauzer va operatsion tizim bo'yicha")}
        >
          <p className="text-v2-small text-v2-text-2">{t("Nom brauzer xabaridan olinadi (masalan «Windows · Chrome»), IP — internet manzili. Shahar bo'yicha joylashuv hali aniqlanmaydi. Har kirish va chiqarish «Amallar jurnali»ga yoziladi.")}</p>
        </Card>
      </div>
      {ask && (
        <V2Confirm
          title={ask === "all" ? t("Boshqa qurilmalardan chiqish") : t("Qurilmani chiqarish")}
          body={ask === "all" ? t("{n} ta qurilmadagi seans yopiladi. Shu qurilmada qolasiz.", { n: others }) : t("Shu qurilmadagi seans darhol yopiladi.")}
          confirmLabel={t("Chiqarish")}
          onConfirm={() => {
            const v = ask;
            setAsk(null);
            void out(v);
          }}
          onCancel={() => setAsk(null)}
        />
      )}
    </>
  );
}
