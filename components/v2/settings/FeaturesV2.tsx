"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks, LayoutList, Loader2, Search, Sparkles } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { NoticeBar, SegmentPills } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";

// YANGI VERSIYA — SOZLAMALAR → «FUNKSIYALAR» (37-qism, rasm «Funksiyalar»). Modullar (Gamifikatsiya, So'rovnoma
// sahifasi), menyu bo'limlari (o'chirilgani yangi menyuda hech kimda ko'rinmaydi), «Tez orada» ro'yxati (yoqib
// bo'lmaydi) va «So'nggi o'zgarishlar». Server: /api/features (lib/features.ts) — faqat direktor.

type Data = {
  ok: true;
  modules: { gamification: boolean; survey: boolean };
  menu: { key: string; label: string; on: boolean }[];
  log: { text: string; by: string; at: string }[];
};
type Tab = "all" | "on" | "off" | "soon";
const uzStamp = (at: string, dm: (iso: string) => string) => {
  const u = new Date(Date.parse(at) + 5 * 3600_000).toISOString();
  return `${dm(u.slice(0, 10))} | ${u.slice(11, 16)}`;
};
type Item = { key: string; title: string; sub: string; on: boolean | null };

const SOON: Item[] = [
  { key: "s1", title: "Qarz limiti", sub: "Limitdan oshgan o'quvchini yangi guruhga yozib bo'lmaydi", on: null },
  { key: "s2", title: "Guruh almashganda eski narx saqlansin", sub: "O'quvchi boshqa kursga o'tsa ham avvalgi narxda qoladi", on: null },
  { key: "s3", title: "Kelmaganni guruhdan avtomatik chiqarish", sub: "Ketma-ket kelmasa — avtomatik chiqarish", on: null },
  { key: "s4", title: "Telefonni SMS kod bilan tasdiqlash", sub: "Raqam xato yozilmasin — o'quvchiga kod boradi", on: null },
  { key: "s5", title: "Ikki bosqichli kirish", sub: "Yangi qurilmada paroldan keyin kod", on: null },
  { key: "s6", title: "Chat", sub: "Xodimlar o'rtasida yozishma", on: null },
  { key: "s7", title: "Mobil ilova", sub: "O'quvchi va xodim uchun", on: null },
];

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function FeaturesV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/features");
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function set(key: string, on: boolean) {
    setBusy(key);
    const r = await fetch("/api/features", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, on }) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(null);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(on ? t("Yoqildi") : t("O'chirildi"));
    reload();
    router.refresh();
  }

  const modules: Item[] = d
    ? [
        { key: "gamification", title: "Gamifikatsiya", sub: "Tanga, reyting, do'kon va musobaqa — o'quvchi va ustoz uchun", on: d.modules.gamification },
        { key: "survey", title: "So'rovnoma sahifasi ochiq", sub: "Reklama havolasidan lid qoldirish (Kampaniya havolalari ham shu orqali)", on: d.modules.survey },
      ]
    : [];
  const menu: Item[] = (d?.menu ?? []).map((m) => ({ key: `menu:${m.key}`, title: m.label, sub: "", on: m.on }));
  const all = [...modules, ...menu, ...SOON];
  const match = (i: Item) => (!q || t(i.title).toLowerCase().includes(q.toLowerCase())) && (tab === "all" || (tab === "on" ? i.on === true : tab === "off" ? i.on === false : i.on === null));
  const cnt = (f: (i: Item) => boolean) => all.filter(f).length;

  const Row = (i: Item) => (
    <li key={i.key} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className={`font-semibold ${i.on === null ? "text-v2-text-2" : "text-v2-text"}`}>{t(i.title)}</div>
        {i.sub && <div className="text-v2-small text-v2-text-2">{t(i.sub)}</div>}
      </div>
      {i.on === null && <span className="rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-info">{t("Tez orada")}</span>}
      {busy === i.key ? <Loader2 className="size-5 animate-spin text-v2-text-3" aria-hidden /> : <Switch on={!!i.on} label={t(i.title)} disabled={i.on === null} onChange={(v) => void set(i.key, v)} />}
    </li>
  );

  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">Tizimli</div>
        <h1 className="text-v2-page text-v2-text">{t("Funksiyalar")}</h1>
        <p className="max-w-[640px] text-v2-small text-v2-text-2">{t("Markazda qaysi imkoniyat ishlashini tanlang. «Tez orada» — hali ishga tushmagan: yoqib bo'lmaydi.")}</p>
      </div>
      {error && <NoticeBar>{t("Ma'lumot olinmadi")}</NoticeBar>}
      {!d && !error && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {d && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentPills<Tab>
              items={[
                { key: "all", label: t("Hammasi"), count: all.length },
                { key: "on", label: t("Yoqilgan"), count: cnt((i) => i.on === true) },
                { key: "off", label: t("O'chiq"), count: cnt((i) => i.on === false) },
                { key: "soon", label: t("Tez orada"), count: cnt((i) => i.on === null) },
              ]}
              value={tab}
              onChange={setTab}
            />
            <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 sm:w-64">
              <Search className="size-4 text-v2-text-3" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Funksiyani qidirish")} className="min-w-0 flex-1 bg-transparent text-v2-body outline-none" />
            </label>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              {modules.some(match) && (
                <Group Icon={Blocks} title={t("Modullar")} sub={t("O'chirilsa — bo'lim sahifalari yopiladi, ma'lumot saqlanadi")}>
                  {modules.filter(match).map(Row)}
                </Group>
              )}
              {SOON.some(match) && (
                <Group Icon={Sparkles} title={t("Tez orada")} sub={t("Tayyor bo'lganda shu yerda yoqiladi")}>
                  {SOON.filter(match).map(Row)}
                </Group>
              )}
            </div>
            <div className="space-y-4">
              {menu.some(match) && (
                <Group Icon={LayoutList} title={t("Menyu bo'limlari")} sub={t("O'chirilgan bo'lim yangi versiya menyusida hech kimda ko'rinmaydi, ma'lumoti saqlanadi")}>
                  {menu.filter(match).map(Row)}
                </Group>
              )}
              <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
                <h2 className="mb-2 font-semibold text-v2-text">{t("So'nggi o'zgarishlar")}</h2>
                <ul className="divide-y divide-v2-border">
                  {d.log.map((l, i) => (
                    <li key={i} className="py-2.5">
                      <div className="text-v2-small font-semibold text-v2-text">{t(l.text)}</div>
                      <div className="text-v2-caption text-v2-text-2">{[l.by, uzStamp(l.at, fmt.dayMonth)].filter(Boolean).join(" · ")}</div>
                    </li>
                  ))}
                  {!d.log.length && <li className="py-2.5 text-v2-small text-v2-text-3">{t("Hali o'zgarish yo'q")}</li>}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Group({ Icon, title, sub, children }: { Icon: typeof Blocks; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="mb-1 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-v2-text">{title}</h2>
          <p className="text-v2-small text-v2-text-2">{sub}</p>
        </div>
      </div>
      <ul className="divide-y divide-v2-border">{children}</ul>
    </section>
  );
}
