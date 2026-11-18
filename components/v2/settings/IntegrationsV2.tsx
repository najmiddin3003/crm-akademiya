"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import UnassignedPupilModal from "@/components/finance/UnassignedPupilModal";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { IntegrationsStatus } from "@/lib/integrationsStatus";

// YANGI VERSIYA — SOZLAMALAR → MOLIYA → «INTEGRATSIYALAR» (32-qism, rasm «Integratsiyalar»). Tashqi tizimlar
// kartalari HAQIQIY holat bilan (Ulangan / Qo'lda / Ulanmagan / Muammo), sanoqlar va «Biriktirilmagan
// to'lovlar». Server: /api/integrations-status (lib/integrationsStatus.ts). Biriktirish — mavjud oyna
// (components/finance/UnassignedPupilModal.tsx).

type Tone = "on" | "manual" | "off" | "warn";
const TONE: Record<Tone, string> = {
  on: "bg-v2-success-bg text-v2-success",
  manual: "bg-v2-info-bg text-v2-info",
  off: "bg-v2-surface-2 text-v2-text-2",
  warn: "bg-v2-warning-bg text-v2-warning",
};
const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");

export default function IntegrationsV2() {
  const { t } = useT();
  const fmt = useProfileFmt();
  const [s, setS] = useState<IntegrationsStatus | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const [assign, setAssign] = useState(false);

  useEffect(() => {
    let off = false;
    void fetch("/api/integrations-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (off) return;
        if (j?.ok) setS(j);
        else setErr(String(j?.error || "Ma'lumot olinmadi"));
      })
      .catch(() => !off && setErr("Tarmoq xatosi"));
    return () => {
      off = true;
    };
  }, [ver]);

  const syncTone: Tone = !s ? "off" : !s.sync.enabled ? "off" : s.sync.failed > 0 || s.sync.issues > 0 ? "warn" : "on";
  const runAt = s?.sync.lastRun?.at ? `${fmt.dayMonth(s.sync.lastRun.at.slice(0, 10))} ${s.sync.lastRun.at.slice(11, 16)}` : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-v2-small text-v2-text-2">{t("Moliya")}</p>
          <h1 className="text-v2-page text-v2-text">{t("Integratsiyalar")}</h1>
          <p className="mt-0.5 max-w-2xl text-v2-small text-v2-text-2">{t("Onlayn to'lovlar, bank va boshqa tizimlar bilan bog'lanish. To'lov tushishi bilan o'quvchiga biriktiriladi va kassaga yoziladi.")}</p>
        </div>
        <button type="button" onClick={() => setVer((v) => v + 1)} className={secondaryBtn}>
          <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
          {t("Yangilash")}
        </button>
      </div>
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!s && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}

      {s && (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Tile
              letter="P"
              tint="bg-v2-info-bg text-v2-info"
              name="Payme · Click"
              kind={t("Onlayn to'lov")}
              tone="manual"
              status={t("Qo'lda yoziladi")}
              lines={[
                s.online.count ? t("{m}: {n} ta to'lov · {s} so'm", { m: fmt.monthName(s.month), n: s.online.count, s: nf(s.online.sum) }) : t("{m}da to'lov yozilmagan", { m: fmt.monthName(s.month) }),
                t("Avtomatik tushishi uchun merchant kalitlari kerak"),
              ]}
              action={
                <Link href="/finance-cash" className={secondaryBtn}>
                  {t("Kassalar")}
                </Link>
              }
            />
            <Tile letter="U" tint="bg-v2-surface-2 text-v2-text-2" name="Uzum Bank" kind={t("Onlayn to'lov")} tone="off" status={t("Ulanmagan")} lines={[t("Ota-ona Uzum ilovasidan ham to'lay oladi"), t("Ulash uchun merchant ID kerak")]} />
            <Tile
              letter="E"
              tint="bg-v2-warning-bg text-v2-warning"
              name={t("Eski tizim")}
              kind={t("Google Sheets · sinxronizatsiya")}
              tone={syncTone}
              status={!s.sync.enabled ? t("O'chirilgan") : syncTone === "warn" ? t("{n} ta muammo", { n: s.sync.issues + s.sync.failed }) : t("Ulangan")}
              lines={[t("Navbatda {p} ta · xato {f} ta", { p: s.sync.pending, f: s.sync.failed }), runAt ? t("Oxirgi tekshiruv: {d}", { d: runAt }) : t("Hali tekshirilmagan")]}
              action={
                <Link href="/finance-sync" className={secondaryBtn}>
                  {t("Batafsil")}
                </Link>
              }
            />
            <Tile
              letter="T"
              tint="bg-v2-info-bg text-v2-info"
              name={t("Telegram botlar")}
              kind={t("Xodim va o'quvchi boti")}
              tone={s.bots.staff && s.bots.student ? "on" : s.bots.staff || s.bots.student ? "warn" : "off"}
              status={s.bots.staff && s.bots.student ? t("Ulangan") : s.bots.staff || s.bots.student ? t("Qisman") : t("Ulanmagan")}
              lines={[
                `${t("Xodimlar boti")}: ${s.bots.staff ? t("ishlaydi") : t("sozlanmagan")}`,
                `${t("O'quvchi boti")}: ${s.bots.student ? (s.bots.studentPush ? t("ishlaydi, xabarlar yoqilgan") : t("ishlaydi, xabarlar o'chiq")) : t("sozlanmagan")}`,
              ]}
            />
            <Tile
              letter="S"
              tint="bg-v2-success-bg text-v2-success"
              name="SMS · Eskiz"
              kind={t("SMS xabarlar")}
              tone={s.sms.eskiz ? "on" : "off"}
              status={s.sms.eskiz ? t("Ulangan") : t("Ulanmagan")}
              lines={[s.sms.paymentSms ? t("To'lov SMS i yoqilgan") : t("To'lov SMS i o'chiq"), t("Taklif va parol tiklash SMS lari")]}
              action={
                <div className="flex flex-wrap gap-2">
                  <Link href="/nazorat-sms-analytics" className={secondaryBtn}>
                    {t("Xabarlar")}
                  </Link>
                  {/* 40-qism: SIM-kartali qurilmalar ro'yxati. */}
                  <Link href="/settings-sms-devices" className={secondaryBtn}>
                    {t("SMS qurilmalar")}
                  </Link>
                </div>
              }
            />
            <Tile letter="F" tint="bg-v2-surface-2 text-v2-text-2" name={t("Fiskal chek")} kind={t("Soliq tizimi")} tone="off" status={t("Ulanmagan")} lines={[t("To'lov cheki soliq tizimiga yuboriladi"), t("Chekda QR kod chiqadi")]} />
          </section>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-v2-section text-v2-text">
                  {t("Biriktirilmagan to'lovlar")}
                  <span className={`rounded-full px-2 py-0.5 text-v2-small font-semibold ${s.unassigned ? "bg-v2-warning-bg text-v2-warning" : "bg-v2-success-bg text-v2-success"}`}>{s.unassigned}</span>
                </h2>
                <p className="text-v2-small text-v2-text-2">{t("Pul kassaga tushgan, lekin qaysi o'quvchiniki ekani aniq emas (ismi bir xil o'quvchilar)")}</p>
              </div>
              {s.unassigned > 0 && (
                <button type="button" onClick={() => setAssign(true)} className={secondaryBtn}>
                  {t("Biriktirish")}
                </button>
              )}
            </div>
            <p className="border-t border-v2-border px-5 py-3 text-v2-small text-v2-text-2">
              {s.unassigned ? t("Biriktirilmaguncha to'lov o'quvchi balansiga tushmaydi.") : t("Hamma to'lov o'z egasiga biriktirilgan.")}
            </p>
          </section>
        </>
      )}

      {assign && (
        <UnassignedPupilModal
          onClose={() => setAssign(false)}
          onChanged={() => setVer((v) => v + 1)}
        />
      )}
    </div>
  );
}

function Tile({ letter, tint, name, kind, tone, status, lines, action }: { letter: string; tint: string; name: string; kind: string; tone: Tone; status: string; lines: string[]; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-v2-md text-[17px] font-semibold ${tint}`}>{letter}</span>
        <div className="min-w-0">
          <div className="font-semibold text-v2-text">{name}</div>
          <div className="text-v2-small text-v2-text-2">{kind}</div>
        </div>
      </div>
      <span className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-v2-small font-semibold ${TONE[tone]}`}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {status}
      </span>
      <div className="mt-2 flex-1 space-y-0.5 text-v2-small text-v2-text-2">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {action && <div className="mt-3 border-t border-v2-border pt-3">{action}</div>}
    </div>
  );
}
