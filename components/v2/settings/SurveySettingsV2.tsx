"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CheckCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Gauge,
  GraduationCap,
  Info,
  Languages,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Megaphone,
  MessageSquareText,
  Pencil,
  Phone,
  QrCode,
  RefreshCw,
  School,
  SquareArrowOutUpRight,
  UserRound,
} from "lucide-react";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { useShell } from "@/components/v2/shell/ShellContext";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { CENTER_INSTAGRAM_HANDLE, CENTER_NAME } from "@/lib/center";
import { SURVEY_SOURCE, hasDaraja, type LeadSettings, type LeadYonalish } from "@/lib/leadSettings";
import { hasSectionPermission } from "@/lib/permissions";
import { splitCreated } from "@/lib/sourceStats";
import { SurveyDirectionsDialogV2, SurveyListDialogV2, type ListItem } from "./SurveyListDialogV2";

// YANGI VERSIYA — SOZLAMALAR → LIDLAR → «SO'ROVNOMA SAHIFASI» (rasm, yorug'/qorong'i,
// 24-qism, 13.11.2026; `/settings-sales?tab=leads`, eski Lidlar tabi `&view=old`).
//
//   • «Havola va QR kod» — ochiq /sorovnoma havolasi (joriy domen), nusxa, QR (npm `qrcode`,
//     loyihada bor — QR davomat), PNG yuklab olish; «Sahifa ochiq» (lib/surveyOpen.ts);
//     bugungi arizalar va oxirgisi (lidlar qamrovida), manba, kimga xabar boradi.
//   • «Savollar» — ochiq sahifadagi HAQIQIY savollar qadamlar tartibida
//     (components/leads/SurveyPage.tsx). Sozlanadigani: yo'nalishlar (yoqish, nomi, savoli),
//     fan/til/maktab variantlari, daraja shkalasi, sinflar, qulay vaqtlar
//     (PUT /api/lead-settings — eski Lidlar tabi bilan bitta sozlama). Filial va manba —
//     o'z sahifalarida. Savol qo'shish, majburiylik va tartib — o'zgarmaydi (halol izoh).
//   • «Yuborilgandan keyin» — sahifadagi tayyor matn (o'zgarmaydi).
//   • O'ngda — telefon ko'rinishi (statik, haqiqiy sozlamalardan).
// Tahrir — admin yoki «Sotuv va marketing» sozlamalari ruxsati (route ham shuni tekshiradi).

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

interface SurveyStats {
  open: boolean;
  today: number;
  todayDay: string;
  lastCreated: string | null;
  filiallar: { id: number; nom: string; telefon: string }[];
  manbalar: string[];
}

interface QRow {
  key: string;
  icon: IconType;
  title: string;
  /** ««Chet tili» tanlansa». */
  cond?: string;
  sub: string;
  required: boolean;
  /** Yo'nalishni yoqish/o'chirish. */
  toggle?: { on: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void };
  edit?: { label: string; onClick: () => void };
  link?: { label: string; href: string };
  dim?: boolean;
}

type Editing =
  | { kind: "dirs" }
  | { kind: "fan"; id: LeadYonalish["id"] }
  | { kind: "bosqichlar" }
  | { kind: "sinflar" }
  | { kind: "vaqtlar" };

const noSubscribe = () => () => {};
const card = "rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm";
const iconBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";

/** "Ona tili · Matematika · Fizika · +5" */
function preview(list: string[], tr: (s: string) => string, n = 4): string {
  const head = list.slice(0, n).map(tr).join(" · ");
  return list.length > n ? `${head} · +${list.length - n}` : head;
}

async function putSettings(body: object): Promise<{ ok: true; data: { settings?: LeadSettings; surveyOpen?: boolean } } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/lead-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => null);
    return d?.ok ? { ok: true, data: d } : { ok: false, error: String(d?.error || "Saqlanmadi") };
  } catch {
    return { ok: false, error: "Serverga ulanib bo'lmadi" };
  }
}

export default function SurveySettingsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { permissions, isAdmin } = useShell();
  const canEdit = isAdmin || hasSectionPermission("/settings-sales", permissions);
  const [settings, setSettings] = useState<LeadSettings | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [openSaving, setOpenSaving] = useState(false);
  const [qr, setQr] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let off = false;
    fetch("/api/lead-settings?stats=survey")
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (off) return;
        if (!r.ok || !d?.ok) return setError(String(d?.error || "Ma'lumot yuklanmadi"));
        setSettings(d.settings as LeadSettings);
        setStats(d.survey as SurveyStats);
        setError("");
      })
      .catch(() => {
        if (!off) setError("Serverga ulanib bo'lmadi");
      });
    return () => {
      off = true;
    };
  }, [version]);

  // Havola — joriy domendan (har markaz o'z serverida: Akademiya, Temuriylar); serverda — bo'sh.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = origin ? `${origin}/sorovnoma` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void import("qrcode")
      .then((m) => m.default.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }))
      .then((d) => !cancelled && setQr(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      showSuccess(t("So'rovnoma havolasi nusxalandi"));
    } catch {
      showError(t("Havolani nusxalab bo'lmadi"));
    }
  }

  async function downloadQr() {
    try {
      const m = await import("qrcode");
      const data = await m.default.toDataURL(url, { margin: 2, width: 1024, errorCorrectionLevel: "M" });
      const a = document.createElement("a");
      a.href = data;
      a.download = "sorovnoma-qr.png";
      a.click();
    } catch {
      showError(t("QR kodni yaratib bo'lmadi"));
    }
  }

  async function setOpen(v: boolean) {
    setOpenSaving(true);
    const r = await putSettings({ surveyOpen: v });
    setOpenSaving(false);
    if (!r.ok) return showError(t(r.error));
    setStats((s) => (s ? { ...s, open: v } : s));
    showSuccess(v ? t("So'rovnoma sahifasi ochildi") : t("So'rovnoma sahifasi yopildi — ochganlar «vaqtincha yopiq» yozuvini ko'radi"));
  }

  async function save(next: LeadSettings, message: string): Promise<boolean> {
    const r = await putSettings({ settings: next });
    if (!r.ok) {
      showError(t(r.error));
      return false;
    }
    if (r.data.settings) setSettings(r.data.settings);
    showSuccess(message);
    return true;
  }

  const setYon = (id: LeadYonalish["id"], patch: Partial<LeadYonalish>) =>
    settings ? { ...settings, yonalishlar: settings.yonalishlar.map((y) => (y.id === id ? { ...y, ...patch } : y)) } : null;

  function toggleYon(y: LeadYonalish, on: boolean) {
    if (!settings) return;
    if (!on && settings.yonalishlar.filter((x) => x.yoqilgan && x.fanlar.length > 0).length <= 1) {
      showError(t("Kamida bitta yo'nalish yoqilgan bo'lsin — sahifani yopish uchun «Sahifa ochiq»ni o'chiring"));
      return;
    }
    const next = setYon(y.id, { yoqilgan: on });
    if (next) void save(next, on ? t("«{name}» so'rovnomada ko'rinadi", { name: t(y.nom) }) : t("«{name}» so'rovnomadan olindi", { name: t(y.nom) }));
  }

  const tr = (s: string) => t(s);
  const rows: { step: string; items: QRow[] }[] = [];
  if (settings && stats) {
    const yon = settings.yonalishlar;
    const on = yon.filter((y) => y.yoqilgan && y.fanlar.length > 0);
    const til = yon.find((y) => hasDaraja(y.id));
    const sinfYon = yon.filter((y) => !hasDaraja(y.id));
    const lockEdit = (label: string, onClick: () => void) => (canEdit ? { label, onClick } : undefined);
    rows.push({
      step: t("1-qadam · Nimani o'rganmoqchi"),
      items: [
        {
          key: "yon",
          icon: ListChecks,
          title: t("Yo'nalish"),
          sub: `${t("Bitta tanlov")} · ${on.map((y) => t(y.nom)).join(" · ") || t("hammasi o'chiq")}`,
          required: true,
          edit: lockEdit(t("Yo'nalish nomlari va savollari"), () => setEditing({ kind: "dirs" })),
        },
        ...yon.map<QRow>((y) => ({
          key: `fan-${y.id}`,
          icon: hasDaraja(y.id) ? Languages : y.id === "pm" ? School : BookOpen,
          title: t(y.savol),
          cond: t("«{name}» tanlansa", { name: t(y.nom) }),
          sub: `${t("Bitta tanlov")} · ${preview(y.fanlar.map((f) => f.nom), tr)} · ${t("{n} ta", { n: y.fanlar.length })}`,
          required: true,
          dim: !y.yoqilgan,
          toggle: {
            on: y.yoqilgan,
            disabled: !canEdit,
            label: t("«{name}» yo'nalishi so'rovnomada", { name: t(y.nom) }),
            onChange: (v) => toggleYon(y, v),
          },
          edit: lockEdit(t("{name} — variantlar", { name: t(y.nom) }), () => setEditing({ kind: "fan", id: y.id })),
        })),
        ...(til
          ? [
              {
                key: "daraja",
                icon: Gauge,
                title: t("Darajangiz"),
                cond: t("«{name}» tanlansa", { name: t(til.nom) }),
                sub: `${t("Shkala")} · ${preview(settings.bosqichlar, tr, 3)} · ${t("yoki «daraja testi»")}`,
                required: true,
                dim: !til.yoqilgan,
                edit: lockEdit(t("Daraja shkalasi"), () => setEditing({ kind: "bosqichlar" })),
              } satisfies QRow,
            ]
          : []),
        {
          key: "sinf",
          icon: GraduationCap,
          title: t("Nechanchi sinf?"),
          cond: t("«{name}» tanlansa", { name: sinfYon.map((y) => t(y.nom)).join(", ") }),
          sub: `${t("Bitta tanlov")} · ${preview(settings.sinflar, tr, 3)} · ${t("{n} ta", { n: settings.sinflar.length })}`,
          required: true,
          dim: !sinfYon.some((y) => y.yoqilgan),
          edit: lockEdit(t("Sinflar"), () => setEditing({ kind: "sinflar" })),
        },
      ],
    });
    rows.push({
      step: t("2-qadam · Filial va vaqt"),
      items: [
        {
          key: "filial",
          icon: Building2,
          title: t("Qaysi filial?"),
          sub: `${t("Bitta tanlov")} · ${t("Filiallar ro'yxatidan")} · ${t("{n} ta", { n: stats.filiallar.length })}`,
          required: true,
          link: { label: t("Filiallar"), href: "/management-filiallar" },
        },
        {
          key: "vaqt",
          icon: Clock,
          title: t("Qaysi vaqt qulay?"),
          sub: `${t("Bitta tanlov")} · ${preview(settings.vaqtlar, tr, 3)}`,
          required: true,
          edit: lockEdit(t("Qulay vaqtlar"), () => setEditing({ kind: "vaqtlar" })),
        },
      ],
    });
    rows.push({
      step: t("3-qadam · Aloqa"),
      items: [
        { key: "ism", icon: UserRound, title: t("Ism familiya"), sub: `${t("Matn")} · ${t("kamida 3 harf")}`, required: true },
        { key: "tel", icon: Phone, title: t("Telefon"), sub: `${t("Telefon")} · ${t("bir raqamdan 10 daqiqada bitta lid")}`, required: true },
        {
          key: "manba",
          icon: Megaphone,
          title: t("Bizni qayerdan bildingiz?"),
          sub: `${t("Bitta tanlov")} · ${preview(stats.manbalar, tr, 4)}`,
          required: true,
          link: { label: t("Manbalar"), href: "/sales-sources" },
        },
        { key: "izoh", icon: MessageSquareText, title: t("Izoh"), sub: t("Matn"), required: false },
      ],
    });
  }
  const count = rows.reduce((s, g) => s + g.items.length, 0);

  const last = splitCreated(stats?.lastCreated);
  const lastText = last ? (last.date === stats?.todayDay ? last.time : last.date) : "";
  const filialPhone = stats?.filiallar.find((b) => b.telefon)?.telefon ?? "";
  const open = stats?.open !== false;

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="min-w-0 max-w-[44rem]">
        <div className="text-v2-caption text-v2-text-2">{t("Lidlar")}</div>
        <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("So'rovnoma sahifasi")}</h1>
        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Lid o'zi to'ldiradigan ochiq sahifa. Javoblar lid kartasidagi «So'rovnoma javoblari»ga tushadi.")}</p>
      </div>

      {error && !settings ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(error)}</p>
          <button type="button" onClick={() => setVersion((v) => v + 1)} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_272px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* 2. Havola va QR kod */}
            <section className={card} aria-label={t("Havola va QR kod")}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                  <QrCode className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                  {t("Havola va QR kod")}
                </h2>
                {stats && (
                  <span className="inline-flex items-center gap-2 text-v2-small text-v2-text">
                    {openSaving && <Loader2 className="size-3.5 animate-spin text-v2-text-3" strokeWidth={2} aria-hidden />}
                    <EmployeeToggle checked={open} onChange={(v) => void setOpen(v)} disabled={!canEdit || openSaving} label={t("Sahifa ochiq")} />
                  </span>
                )}
              </div>
              <div className="space-y-3 p-4">
                {!open && (
                  <p className="flex items-start gap-2 rounded-v2-md border border-v2-warning/40 bg-v2-warning-bg px-3 py-2 text-v2-small text-v2-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-v2-warning" strokeWidth={1.75} aria-hidden />
                    {t("Sahifa yopiq — ochganlar «So'rovnoma vaqtincha yopiq» yozuvini ko'radi, yangi ariza qabul qilinmaydi. Telegram botdagi «Kursga yozilish» ishlayveradi.")}
                  </p>
                )}
                <div className="flex flex-col gap-2 min-[36rem]:flex-row">
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-v2-md border border-v2-border-field bg-v2-surface-2 px-3 text-v2-body text-v2-text">
                    <Link2 className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                    <span className="truncate" title={url}>
                      {url.replace(/^https?:\/\//, "") || "…/sorovnoma"}
                    </span>
                  </div>
                  <button type="button" onClick={() => void copyLink()} disabled={!url} className={`${secondaryBtn} h-10 disabled:opacity-50`}>
                    <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                    {t("Nusxa olish")}
                  </button>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-v2-md border border-v2-border bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, brauzerda yaratilgan QR */}
                    {qr ? <img src={qr} alt={t("So'rovnoma QR kodi")} className="size-full [image-rendering:pixelated]" /> : <div className="size-full rounded bg-v2-skeleton" />}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-v2-small text-v2-text-2">{t("Flayer, banner va ofis eshigiga. Skaner qilgan odam shu sahifaga tushadi.")}</p>
                    <button type="button" onClick={() => void downloadQr()} disabled={!url} className={`${secondaryBtn} disabled:opacity-50`}>
                      <Download className="size-4" strokeWidth={1.75} aria-hidden />
                      {t("QR kod · PNG")}
                    </button>
                  </div>
                </div>
                {stats && (
                  <div className="space-y-1 border-t border-v2-border pt-3 text-v2-caption font-normal text-v2-text-2">
                    <p>
                      <span className="tabular-nums">
                        {t("Bugun {n} ta ariza", { n: stats.today })}
                        {lastText ? ` · ${t("oxirgisi {when}", { when: lastText })}` : ` · ${t("hali ariza yo'q")}`}
                      </span>
                      {" · "}
                      {t("Manba o'zi yoziladi")}: <span className="font-semibold text-v2-text">{t(SURVEY_SOURCE)}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <Bell className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span>
                        {t("Xabar boradi: filialning Telegram «Lidlar» topigiga va Lidlar bo'limiga ruxsati borlarning qo'ng'irog'iga.")}{" "}
                        <Link href="/management-filiallar" className="text-v2-brand-text underline-offset-2 hover:underline">
                          {t("Topiklar — Filiallarda")}
                        </Link>
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Savollar */}
            <section className={`${card} overflow-hidden`} aria-label={t("Savollar")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                  <ListChecks className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                  {t("Savollar")}
                  {count > 0 && <span className="font-normal text-v2-text-3">· {count}</span>}
                </h2>
                <span className="text-v2-caption font-normal text-v2-text-3">{t("Lid kartasida ham shu tartibda")}</span>
              </div>
              {!settings || !stats ? (
                <div className="space-y-2 px-4 pb-4" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="h-[52px] rounded-v2-md bg-v2-skeleton" />
                  ))}
                </div>
              ) : (
                rows.map((g) => (
                  <div key={g.step}>
                    <div className="border-y border-v2-border bg-v2-surface-2 px-4 py-1.5 text-v2-caption font-semibold text-v2-text-2">{g.step}</div>
                    {g.items.map((q) => (
                      <QuestionRow key={q.key} q={q} />
                    ))}
                  </div>
                ))
              )}
              <p className="flex items-start gap-1.5 border-t border-v2-border px-4 py-3 text-v2-caption font-normal text-v2-text-2">
                <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("Yangi savol qo'shish, majburiylik va tartibni o'zgartirish hozircha yo'q — javoblar lid kartasi, Telegram xabari va hisobotlarga bog'langan. Variantlarni ✎ orqali tahrirlang.")}
              </p>
            </section>

            {/* 4. Yuborilgandan keyin */}
            <section className={card} aria-label={t("Yuborilgandan keyin")}>
              <div className="px-4 pt-3">
                <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                  <CheckCheck className="size-4 text-v2-text-2" strokeWidth={1.75} aria-hidden />
                  {t("Yuborilgandan keyin")}
                </h2>
              </div>
              <div className="space-y-2 p-4">
                <div className="text-v2-small font-medium text-v2-text-2">{t("Xabar matni")}</div>
                <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2.5 text-v2-body text-v2-text">
                  <span className="font-semibold">{t("Qabul qilindi!")}</span> {t("24 soat ichida {tel} raqamiga qo'ng'iroq qilamiz.", { tel: "94 *** ** 55" })}
                </div>
                <p className="flex items-start gap-1.5 text-v2-caption font-normal text-v2-text-2">
                  <Lock className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span>
                    {t("Ostida — tanlangan kurs, filial va vaqt hamda «Savol bo'lsa:» qatorida lid tanlagan filialning telefoni")}
                    {filialPhone ? ` (${t("masalan")}, ${filialPhone})` : ""}. {t("Matn hozircha o'zgarmaydi.")}
                  </span>
                </p>
              </div>
            </section>

            <Link
              href="/settings-sales?tab=leads&view=old"
              className="inline-flex items-center gap-1.5 self-start text-v2-small text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline"
            >
              <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              {t("Rad sabablari va to'liq Lidlar sozlamalari — eski ko'rinishda")}
            </Link>
          </div>

          {/* 5. Telefon ko'rinishi */}
          <aside className="lg:sticky lg:top-4" aria-label={t("Ko'rinishi")}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-v2-small font-medium text-v2-text-2">{t("Ko'rinishi")}</span>
              <a href="/sorovnoma" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand-text hover:underline">
                <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("Ochish")}
              </a>
            </div>
            <PhonePreview settings={settings} open={open} />
            <p className="mt-2 text-v2-caption font-normal text-v2-text-3">{t("Haqiqiy sahifa 3 qadamli — bu qisqa ko'rinish. Logotip va nom — «Markaz ma'lumotlari»dan.")}</p>
          </aside>
        </div>
      )}

      {editing && settings && (
        <EditDialogs
          editing={editing}
          settings={settings}
          onClose={() => setEditing(null)}
          save={save}
        />
      )}
    </div>
  );
}

function QuestionRow({ q }: { q: QRow }) {
  const { t } = useT();
  const Icon = q.icon;
  return (
    <div className={`flex items-center gap-3 border-b border-v2-border px-4 py-2.5 last:border-b-0 ${q.dim ? "opacity-60" : ""}`}>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-text-2" aria-hidden>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-v2-small font-semibold text-v2-text">{q.title}</span>
          {q.cond && <span className="rounded-v2-sm border border-v2-brand/30 bg-v2-brand-bg px-1.5 py-px text-v2-caption font-medium text-v2-brand-text">{q.cond}</span>}
        </div>
        <div className="truncate text-v2-caption font-normal text-v2-text-2" title={q.sub}>
          {q.sub}
        </div>
      </div>
      {/* Yozuvsiz — matn ('«Fanlar» yo'nalishi so'rovnomada') sichqoncha ostida va ekran o'quvchida. */}
      {q.toggle && <EmployeeToggle checked={q.toggle.on} onChange={q.toggle.onChange} disabled={q.toggle.disabled} title={q.toggle.label} />}
      <span className="hidden w-[84px] shrink-0 items-center gap-1 text-v2-caption font-normal text-v2-text-3 min-[30rem]:inline-flex">
        <Lock className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
        {q.required ? t("majburiy") : t("ixtiyoriy")}
      </span>
      <span className="w-8 shrink-0">
        {q.edit ? (
          <button type="button" onClick={q.edit.onClick} title={q.edit.label} aria-label={q.edit.label} className={iconBtn}>
            <Pencil className="size-4" strokeWidth={1.75} />
          </button>
        ) : q.link ? (
          <Link href={q.link.href} title={q.link.label} aria-label={q.link.label} className={iconBtn}>
            <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
          </Link>
        ) : null}
      </span>
    </div>
  );
}

function EditDialogs({
  editing,
  settings,
  onClose,
  save,
}: {
  editing: Editing;
  settings: LeadSettings;
  onClose: () => void;
  save: (next: LeadSettings, message: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const strings = (items: ListItem[]) => items.map((x) => x.nom);
  if (editing.kind === "dirs") {
    return <SurveyDirectionsDialogV2 yonalishlar={settings.yonalishlar} onClose={onClose} onSave={(yonalishlar) => save({ ...settings, yonalishlar }, t("Yo'nalishlar saqlandi"))} />;
  }
  if (editing.kind === "fan") {
    const y = settings.yonalishlar.find((x) => x.id === editing.id);
    if (!y) return null;
    return (
      <SurveyListDialogV2
        title={t("{name} — variantlar", { name: t(y.nom) })}
        subtitle={t(y.savol)}
        items={y.fanlar}
        max={60}
        onClose={onClose}
        onSave={(fanlar) =>
          save({ ...settings, yonalishlar: settings.yonalishlar.map((x) => (x.id === y.id ? { ...x, fanlar } : x)) }, t("«{name}» variantlari saqlandi", { name: t(y.nom) }))
        }
      />
    );
  }
  const spec = {
    bosqichlar: { title: t("Daraja shkalasi"), subtitle: t("Birinchisi — «0 dan», oxirgisi — eng yuqori"), min: 2, max: 12 },
    sinflar: { title: t("Sinflar"), subtitle: t("Nechanchi sinf?"), min: 1, max: 20 },
    vaqtlar: { title: t("Qulay vaqtlar"), subtitle: t("Qaysi vaqt qulay?"), min: 1, max: 12 },
  }[editing.kind];
  const key = editing.kind;
  return (
    <SurveyListDialogV2
      title={spec.title}
      subtitle={spec.subtitle}
      items={settings[key].map((nom) => ({ nom }))}
      min={spec.min}
      max={spec.max}
      onClose={onClose}
      onSave={(items) => save({ ...settings, [key]: strings(items) }, t("«{name}» saqlandi", { name: spec.title }))}
    />
  );
}

/** Telefon ko'rinishi — ochiq sahifaning 1-qadami, statik (haqiqiy sozlamalardan). */
function PhonePreview({ settings, open }: { settings: LeadSettings | null; open: boolean }) {
  const { t } = useT();
  const on = settings?.yonalishlar.filter((y) => y.yoqilgan && y.fanlar.length > 0) ?? [];
  const chip = "rounded-v2-full border border-v2-border px-2 py-0.5 text-[10px] text-v2-text-2";
  return (
    <div className="mx-auto w-full max-w-[272px] rounded-[28px] border-[5px] border-v2-text bg-v2-surface p-3 shadow-v2-sm" aria-hidden>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-v2-md bg-v2-brand text-[12px] font-bold text-v2-on-brand">{CENTER_NAME.trim().charAt(0).toUpperCase()}</span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold text-v2-text">{CENTER_NAME}</span>
          {CENTER_INSTAGRAM_HANDLE && <span className="block truncate text-[10px] text-v2-text-3">{CENTER_INSTAGRAM_HANDLE}</span>}
        </span>
      </div>
      <div className="mt-3 text-[15px] font-bold leading-5 text-v2-text">
        <span className="text-v2-brand-text">{t("Bepul")}</span> {t("sinov darsiga yoziling")}
      </div>
      {!open || (settings && on.length === 0) ? (
        <p className="mt-3 rounded-v2-md bg-v2-surface-2 p-2 text-[11px] text-v2-text-2">{t("So'rovnoma vaqtincha yopiq — filialga qo'ng'iroq qiling.")}</p>
      ) : (
        <>
          <div className="mt-3 text-[11px] font-semibold text-v2-text">{t("Nimani o'rganmoqchisiz?")}</div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {(settings ? on : []).map((y) => (
              <span key={y.id} className="flex min-h-10 items-center justify-center rounded-v2-md border border-v2-border px-1 text-center text-[10px] font-medium leading-3 text-v2-text">
                {t(y.nom)}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[11px] font-semibold text-v2-text">{t("Qaysi vaqt qulay?")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(settings?.vaqtlar ?? []).slice(0, 3).map((v) => (
              <span key={v} className={chip}>
                {t(v)}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[11px] font-semibold text-v2-text">{t("Ism familiya")}</div>
          <div className="mt-1 h-7 rounded-v2-md border border-v2-border" />
          <div className="mt-2 text-[11px] font-semibold text-v2-text">{t("Telefon")}</div>
          <div className="mt-1 flex h-7 items-center rounded-v2-md border border-v2-border px-2 text-[10px] text-v2-text-3">+998</div>
          <div className={`${primaryBtn} pointer-events-none mt-3 h-8 w-full justify-center text-[12px]`}>{t("Davom etish →")}</div>
        </>
      )}
    </div>
  );
}

