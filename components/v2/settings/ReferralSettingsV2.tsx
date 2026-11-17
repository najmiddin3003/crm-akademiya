"use client";

import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { NoticeBar } from "@/components/v2/students/lists/listKit";
import { REF_KINDS, REF_KIND_LABELS, type RefKind, type RefSettings } from "@/lib/referralTypes";

// YANGI VERSIYA — SOZLAMALAR → LIDLAR → «REFERAL DASTURI» (29-qism, rasm «Sozlamalar · Referal dasturi»). Kim
// taklif qila oladi (o'quvchi, ota-ona, maktab ustozi, boshqa), sertifikat raqami, referal qachon hisoblanadi,
// kod va havola. Saqlash — POST /api/referrals {action: "settings"} (faqat admin).

const KIND_HINT: Record<RefKind, string> = {
  oquvchi: "Kodi va havolasi bor — do'stini olib keladi",
  "ota-ona": "Farzandining kodi bilan yoki o'z kodi bilan",
  ustoz: "Maktab o'qituvchisi — o'quvchilarga Akademiyani tavsiya qiladi",
  boshqa: "Do'kon egasi, tanish — telefon raqami bilan",
};

export default function ReferralSettingsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [s, setS] = useState<RefSettings | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    void fetch("/api/referrals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j?.ok ? setS(j.settings) : setErr(String(j?.error || "Ma'lumot olinmadi"))))
      .catch(() => setErr("Tarmoq xatosi"));
  }, []);

  async function save(next: RefSettings) {
    const prev = s;
    setS(next);
    const r = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings", ...next }) })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) {
      setS(prev);
      return showError(t(r?.error || "Saqlab bo'lmadi"));
    }
    showSuccess(t("Saqlandi"));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-v2-small text-v2-text-2">{t("Lidlar")}</p>
        <h1 className="text-v2-page text-v2-text">{t("Referal dasturi")}</h1>
        <p className="mt-0.5 max-w-2xl text-v2-small text-v2-text-2">
          {t("Ustoz, o'quvchi, ota-ona yoki boshqa odam taklif qilgan o'quvchi birinchi oyini to'lasa, taklif qilganga referal yoziladi. Referallar yig'iladi va sovg'aga almashtiriladi.")}
        </p>
      </div>
      {err && <NoticeBar>{t(err)}</NoticeBar>}
      {!s && !err && (
        <div className="flex items-center gap-2 text-v2-small text-v2-text-3">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t("Yuklanmoqda…")}
        </div>
      )}
      {s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
            <h2 className="mb-3 font-semibold text-v2-text">{t("Kim taklif qila oladi")}</h2>
            <ul className="divide-y divide-v2-border">
              {REF_KINDS.map((k) => (
                <li key={k} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-semibold text-v2-text">{t(REF_KIND_LABELS[k])}</div>
                    <div className="text-v2-small text-v2-text-2">{t(KIND_HINT[k])}</div>
                  </div>
                  <Switch on={s.kinds[k]} label={t(REF_KIND_LABELS[k])} onChange={(v) => void save({ ...s, kinds: { ...s.kinds, [k]: v } })} />
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-4">
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
              <h2 className="mb-2 font-semibold text-v2-text">{t("Referal qachon hisoblanadi")}</h2>
              <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2 font-semibold text-v2-text">{t("Birinchi oy to'liq to'langanda · avtomatik")}</div>
              <p className="mt-2 text-v2-small text-v2-text-2">
                {t("Kassaga to'lov tushishi bilan tekshiriladi: taklif sanasidan keyingi to'lovlar birinchi guruhning oylik narxiga yetsa — +1 referal. Bekor qilingan to'lov hisobga olinmaydi.")}
              </p>
            </section>
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-v2-text">{t("Rag'bat sertifikati")}</h2>
                  <p className="text-v2-small text-v2-text-2">{t("Sertifikat raqami — ustozning referali: «Qo'lda biriktirish»da «Sertifikat» tanlanadi")}</p>
                </div>
                <Switch on={s.certificates} label={t("Sertifikat")} onChange={(v) => void save({ ...s, certificates: v })} />
              </div>
            </section>
          </div>

          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-5 shadow-v2-sm lg:col-span-2">
            <h2 className="mb-3 font-semibold text-v2-text">{t("Kod va havola")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Read label={t("Kod ko'rinishi")} value={t("ISM + raqam, masalan DIYORA27")} />
              <Read label={t("Shaxsiy havola")} value="…/sorovnoma?ref=KOD" />
            </div>
            <p className="mt-3 flex items-start gap-2 text-v2-small text-v2-text-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("Havola ochiq so'rovnoma sahifasini ochadi — to'ldirilgan ariza Lidlarga tushadi va taklif qiluvchiga o'zi yoziladi. Kodni og'zaki aytganlar — Referallar → «Qo'lda biriktirish».")}
            </p>
            <Link href="/sales-referrals" className="mt-3 inline-block text-v2-small font-semibold text-v2-brand">
              {t("Sovg'alar va so'rovlar — Sotuv va marketing → Referallar")} →
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-v2-brand" : "bg-v2-border-strong"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-v2-small text-v2-text-2">{label}</div>
      <div className="rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-text">{value}</div>
    </div>
  );
}
