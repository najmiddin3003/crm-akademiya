"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Newspaper, User, Wallet, LifeBuoy } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useReportData } from "@/components/v2/reports/reportHooks";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { StudentAppPrefs } from "@/lib/studentAppTypes";

// YANGI VERSIYA — SOZLAMALAR → «O'QUVCHI ILOVASI» (38-qism, rasm «Sozlamalar · O'quvchi ilovasi va kontent»).
// Kabinetdan foydalanish ko'rsatkichlari, To'lovlar (balans va qarz), Kontent (hikoyalar, yangiliklar) — ulangan;
// Kirish va profil, Support darslari, ilovadan to'lash — «Tez orada». O'ngda kabinet ko'rinishi va o'zgarishlar.
// Server: /api/student-app (lib/studentAppSettings.ts); kabinet — /api/student-web/me.

type Data = {
  ok: true;
  prefs: StudentAppPrefs;
  pupils: number;
  students: number;
  parents: number;
  lastNews: { title: string; at: string; views: number } | null;
  stories: number;
  news: number;
  log: { text: string; by: string; at: string }[];
};

function Switch({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Group({ Icon, title, sub, children }: { Icon: typeof User; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm sm:p-5">
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

type RowProps = { title: string; sub: string; on?: boolean; k?: keyof StudentAppPrefs; soon?: boolean; busy: boolean; onSet: (p: Partial<StudentAppPrefs>) => void };

function Row({ title, sub, on, k, soon, busy, onSet }: RowProps) {
  const { t } = useT();
  return (
    <li className={`flex items-center gap-3 py-3 ${soon ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-v2-text">{title}</div>
        <div className="text-v2-small text-v2-text-2">{sub}</div>
      </div>
      {soon && <span className="rounded-full bg-v2-info-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-info">{t("Tez orada")}</span>}
      <Switch on={!!on} label={title} disabled={soon || busy} onChange={k ? (v) => onSet({ [k]: v }) : undefined} />
    </li>
  );
}

export default function StudentAppV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { data: d, error, reload } = useReportData<Data>("/api/student-app");
  const [busy, setBusy] = useState(false);
  async function set(p: Partial<StudentAppPrefs>) {
    setBusy(true);
    const r = await fetch("/api/student-app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
      .then((x) => x.json())
      .catch(() => null);
    setBusy(false);
    if (!r?.ok) return showError(t(r?.error || "Saqlab bo'lmadi"));
    showSuccess(t("Saqlandi"));
    reload();
  }

  if (error) return <div className="p-6"><NoticeBar>{t("Faqat direktor uchun")}</NoticeBar></div>;
  if (!d)
    return (
      <div className="flex items-center gap-2 p-6 text-v2-small text-v2-text-3">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
      </div>
    );
  const at = (iso: string) => {
    const u = new Date(Date.parse(iso) + 5 * 3600_000).toISOString();
    return `${fmt.dayMonth(u.slice(0, 10))} | ${u.slice(11, 16)}`;
  };
  return (
    <div className="space-y-4 p-4 sm:p-6 lg:px-8">
      <div>
        <div className="text-v2-small text-v2-text-2">{t("Ilovalar")}</div>
        <h1 className="text-v2-page text-v2-text">{t("O'quvchi ilovasi")}</h1>
        <p className="text-v2-small text-v2-text-2">{t("O'quvchi va ota-ona kabineti (Telegram'dagi o'quvchi boti). O'zgarish keyingi ochilishda ko'rinadi.")}</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <div className="text-v2-small text-v2-text-2">{t("Kabinetdan foydalanadi")}</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums text-v2-text">
            {d.students} <span className="text-v2-text-2">/ {d.pupils}</span>
          </div>
          <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
            <div className="h-full rounded-full bg-v2-brand" style={{ width: `${d.pupils ? Math.min(100, (d.students / d.pupils) * 100) : 0}%` }} />
          </div>
          <div className="text-v2-small text-v2-text-2">{t("{n} o'quvchi hali kirmagan", { n: Math.max(0, d.pupils - d.students) })}</div>
        </div>
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <div className="text-v2-small text-v2-text-2">{t("Ota-ona ham kiradi")}</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums text-v2-text">{d.parents}</div>
          <div className="text-v2-small text-v2-text-2">{t("Telegram bot orqali")}</div>
        </div>
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
          <div className="truncate text-v2-small text-v2-text-2">{d.lastNews ? t("«{n}»ni ko'rdi", { n: d.lastNews.title }) : t("Oxirgi yangilik")}</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums text-v2-text">{d.lastNews ? d.lastNews.views : "—"}</div>
          <div className="text-v2-small text-v2-text-2">{d.lastNews ? t("yangilik {d} da chiqdi", { d: at(d.lastNews.at) }) : t("hali yangilik yo'q")}</div>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Group Icon={Wallet} title={t("To'lovlar")} sub={t("Kabinetdagi «To'lovlar» bo'limi")}>
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Balans va qarzni ko'rish")} sub={t("O'quvchi va ota-ona: oylar bo'yicha qarz; o'chirilsa — faqat to'lovlar tarixi va cheklar")} on={d.prefs.showDebt} k="showDebt" />
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Ilovadan to'lash — Click, Payme")} sub={t("Ishga tushganda qarz kartasida «To'lash» tugmasi chiqadi")} soon />
          </Group>
          <Group Icon={Newspaper} title={t("Kontent")} sub={t("Sotuv va marketing → Yangiliklar va hikoyalarda tayyorlanadi")}>
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Hikoyalar")} sub={t("{n} ta faol · kabinet tepasida doira bo'lib chiqadi, 24 soatdan keyin yashirinadi", { n: d.stories })} on={d.prefs.stories} k="stories" />
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Yangiliklar")} sub={t("{n} ta · kabinet lentasida", { n: d.news })} on={d.prefs.news} k="news" />
            <li className="py-2">
              <Link href="/sales-news" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand">
                {t("Yangiliklar va hikoyalar")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          </Group>
          <Group Icon={User} title={t("Kirish va profil")} sub={t("Kim kiradi va o'zi nimani o'zgartira oladi")}>
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Arxivdagi o'quvchilar kirishi")} sub={t("Ketgan o'quvchi va ota-onasi to'lovlar tarixi va natijalarni ko'radi")} soon />
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Profilni o'zi tahrirlaydi")} sub={t("Rasm, Telegram, tug'ilgan kun; ism va telefon — admin tasdig'i bilan")} soon />
          </Group>
          <Group Icon={LifeBuoy} title={t("Support darslari")} sub={t("O'quvchi bo'sh joyli support darsiga kabinetdan yoziladi")}>
            <Row busy={busy} onSet={(p) => void set(p)} title={t("Yozilish limiti")} sub={t("Bir o'quvchi davr ichida necha marta yozila oladi")} soon />
          </Group>
        </div>
        <div className="space-y-4">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="font-semibold text-v2-text">{t("Kabinetda shunday ko'rinadi")}</h2>
            <p className="text-v2-small text-v2-text-2">{t("hozirgi sozlamalar bilan")}</p>
            <div className="mx-auto mt-3 w-[230px] rounded-[26px] border-4 border-v2-border-strong bg-v2-bg p-3">
              {d.prefs.stories && (
                <div className="mb-2 flex gap-1.5">
                  {["bg-v2-warning-bg", "bg-v2-violet-bg", "bg-v2-info-bg", "bg-v2-success-bg"].map((c) => (
                    <span key={c} className={`size-9 rounded-full border-2 border-v2-brand ${c}`} />
                  ))}
                </div>
              )}
              {d.prefs.showDebt && (
                <div className="mb-2 rounded-v2-md bg-v2-surface p-2">
                  <div className="text-[10px] text-v2-text-2">{t("Qarz")}</div>
                  <div className="text-v2-small font-semibold text-v2-danger">−470 000 so&apos;m</div>
                </div>
              )}
              <div className="mb-2 rounded-v2-md bg-v2-surface p-2">
                <div className="text-[10px] text-v2-text-2">{t("Keyingi dars")}</div>
                <div className="text-v2-small font-semibold text-v2-text">{t("Matematika · ertaga")}</div>
              </div>
              {d.prefs.news && (
                <div className="rounded-v2-md bg-v2-surface p-2">
                  <div className="text-[10px] font-bold uppercase text-v2-info">{t("Sarhisob")}</div>
                  <div className="text-v2-small font-semibold text-v2-text">{d.lastNews?.title ?? t("Yangilik")}</div>
                </div>
              )}
            </div>
          </section>
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="mb-2 font-semibold text-v2-text">{t("So'nggi o'zgarishlar")}</h2>
            <ul className="divide-y divide-v2-border">
              {d.log.map((l, i) => (
                <li key={i} className="py-2.5">
                  <div className="text-v2-small font-semibold text-v2-text">{t(l.text)}</div>
                  <div className="text-v2-caption text-v2-text-2">{[at(l.at), l.by].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
              {!d.log.length && <li className="py-2.5 text-v2-small text-v2-text-3">{t("Hali o'zgarish yo'q")}</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
