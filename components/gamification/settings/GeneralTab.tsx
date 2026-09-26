"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Power } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { Toggle } from "@/components/settings/SettingsForm";
import { gamApi } from "../api";
import type { CoinReason, GamLevel, GamRole, GamSettings, NumericSettingKey } from "@/lib/gamification/types";

// Sozlamalar → Gamifikatsiya → Umumiy (TZ 5.7, prototipdagi «Umumiy»).
// Faqat direktor o'zgartiradi; har maydon o'zgarganda darhol saqlanadi
// (prototipdagidek) va keyingi yozuvlarga qo'llanadi — o'tgan yozuvlar
// o'zgarmaydi. Daraja chegarasi o'zgarsa, avval kimga ta'sir qilishi
// ko'rsatiladi (TZ 4.2.5).

const numCls =
  "h-9 w-24 rounded-lg border border-border bg-card px-2.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";
const cardCls = "rounded-2xl border border-border bg-card p-4 md:p-5";

/** Raqam qatori: fokusdan chiqqanda yoki Enter bosilganda saqlanadi, xato bo'lsa qaytadi. */
function NumRow({
  label,
  value,
  suffix,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  suffix: string;
  disabled: boolean;
  onCommit: (raw: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState(String(value));
  const commit = async () => {
    if (draft.trim() === String(value)) return;
    if (!(await onCommit(draft))) setDraft(String(value));
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <label className="min-w-0 flex-1 text-[13px]">{t(label)}</label>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          step={1}
          aria-label={t(label)}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={numCls}
        />
        <span className="w-14 text-[12px] text-muted-foreground">{t(suffix)}</span>
      </div>
    </div>
  );
}

function RuleNote({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="border-b border-border/60 py-2 text-[12.5px] leading-relaxed text-muted-foreground last:border-0">
      {children}{" "}
      <span className="ml-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{t("qoida")}</span>
    </div>
  );
}

type Pending =
  | { kind: "enable"; on: boolean }
  | { kind: "level"; levels: GamLevel[]; index: number; from: number; to: number; down: number; up: number };

function ConfirmModal({
  pending,
  settings,
  busy,
  onConfirm,
  onClose,
}: {
  pending: Pending;
  settings: GamSettings;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" panelClassName="overflow-y-auto">
      <div className="p-5">
        {pending.kind === "enable" ? (
          <>
            <h2 className="text-[17px] font-semibold">{pending.on ? t("Gamifikatsiyani yoqish") : t("Gamifikatsiyani o'chirish")}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {pending.on
                ? t("Yoqilgan paytdan boshlab davomat, uy vazifasi, faollik va sabablar bo'yicha o'quvchilarga tanga yoziladi. Bo'lim xodimlarga ochiladi.")
                : t("O'chirilgach yangi tanga yozilmaydi va bo'limni faqat direktor ko'radi. Yozilgan tangalar va balanslar saqlanadi.")}
            </p>
            {pending.on && !settings.startDate && (
              <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-[13px] text-primary">
                {t("Bugungi sana gamifikatsiya boshlangan kun sifatida yoziladi — undan oldingi darslar seriya va nishonlarda hisobga olinmaydi.")}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-[17px] font-semibold">{t("Daraja chegarasini o'zgartirish")}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              «{pending.levels[pending.index].name}»: {pending.from} → {pending.to} {t("tanga")}
            </p>
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${pending.down ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}
            >
              {pending.down > 0 && <div>{t("{n} ta o'quvchining darajasi pasayadi.", { n: pending.down })}</div>}
              {pending.up > 0 && <div>{t("{n} ta o'quvchining darajasi ko'tariladi.", { n: pending.up })}</div>}
            </div>
          </>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={modal.close} disabled={busy} className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {t("Bekor")}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="h-9 rounded-lg bg-primary px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
            {busy ? t("Saqlanmoqda…") : pending.kind === "enable" ? (pending.on ? t("Yoqish") : t("O'chirish")) : t("Tasdiqlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function GamGeneralTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<GamSettings | null>(null);
  const [role, setRole] = useState<GamRole | null>(null);
  const [activeReasons, setActiveReasons] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  // Daraja qatorlari qayta chizilishi uchun (saqlanmagan qoralama qaytsin).
  const [levelsKey, setLevelsKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      gamApi<{ settings: GamSettings; role: GamRole }>("/api/gamification/settings"),
      gamApi<{ reasons: CoinReason[] }>("/api/gamification/reasons"),
    ]).then(([s, r]) => {
      if (cancelled) return;
      if (!s.ok) {
        setLoadError(s.error);
        return;
      }
      setSettings(s.settings);
      setRole(s.role);
      if (r.ok) setActiveReasons(r.reasons.filter((x) => x.isActive).length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canEdit = role === "director";

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      const res = await gamApi<{ settings: GamSettings; streakRuleChanged: boolean }>("/api/gamification/settings", { method: "PUT", body });
      if (!res.ok) {
        showError(t(res.error));
        return false;
      }
      setSettings(res.settings);
      showSuccess(t("Saqlandi"));
      return true;
    },
    [showError, showSuccess, t],
  );

  // URL oddiy satr bo'lsin: ruxsatlar generatori andozani (`${…}`) yo'l deb tanimaydi.
  const saveLevels = useCallback(
    async (levels: GamLevel[], preview: boolean) =>
      gamApi<{ levels: GamLevel[]; down: number; up: number; saved: boolean }>(
        preview ? "/api/gamification/levels?preview=1" : "/api/gamification/levels",
        { method: "PUT", body: { levels } },
      ),
    [],
  );

  async function commitLevel(index: number, field: "name" | "minEarned", raw: string): Promise<boolean> {
    if (!settings) return false;
    const levels = settings.levels.map((l, i) => (i === index ? { ...l, [field]: field === "name" ? raw : raw.trim() } : l)) as GamLevel[];
    if (field === "name") {
      const res = await saveLevels(levels, false);
      if (!res.ok) {
        showError(t(res.error));
        return false;
      }
      setSettings({ ...settings, levels: res.levels });
      showSuccess(t("Saqlandi"));
      return true;
    }
    const pre = await saveLevels(levels, true);
    if (!pre.ok) {
      showError(t(pre.error));
      return false;
    }
    if (pre.down === 0 && pre.up === 0) {
      const res = await saveLevels(levels, false);
      if (!res.ok) {
        showError(t(res.error));
        return false;
      }
      setSettings({ ...settings, levels: res.levels });
      showSuccess(t("Saqlandi"));
      return true;
    }
    setPending({ kind: "level", levels: pre.levels, index, from: settings.levels[index].minEarned, to: pre.levels[index].minEarned, down: pre.down, up: pre.up });
    return true;
  }

  async function confirmPending() {
    if (!pending || !settings) return;
    setBusy(true);
    if (pending.kind === "enable") {
      await patch({ enabled: pending.on });
    } else {
      const res = await saveLevels(pending.levels, false);
      if (res.ok) {
        setSettings({ ...settings, levels: res.levels });
        showSuccess(t("Saqlandi"));
      } else showError(t(res.error));
    }
    setBusy(false);
    setPending(null);
    setLevelsKey((k) => k + 1);
  }

  if (loadError) {
    return <div className={`${cardCls} text-center text-[13px] text-muted-foreground`}>{t(loadError)}</div>;
  }
  if (!settings) return <SpinnerBlock size={22} />;

  const num = (key: NumericSettingKey, label: string, suffix = "tanga") => (
    <NumRow key={`${key}:${settings[key]}`} label={label} value={settings[key]} suffix={suffix} disabled={!canEdit} onCommit={(raw) => patch({ [key]: raw })} />
  );

  return (
    <div className="gm-page space-y-4">
      <div>
        <h1 className="text-[17px] font-semibold">{t("Sozlamalar → Gamifikatsiya")}</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {t("Faqat direktor o'zgartiradi. O'zgarish darhol kuchga kiradi va keyingi yozuvlarga qo'llanadi — o'tgan yozuvlar o'zgarmaydi.")}
        </p>
      </div>

      <div className={`${cardCls} flex flex-wrap items-center gap-4`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${settings.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
          <Power className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{t("Gamifikatsiya moduli")}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${settings.enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-secondary text-muted-foreground"}`}>
              {settings.enabled ? t("Yoqilgan") : t("O'chiq")}
            </span>
            {settings.startDate && (
              <span className="text-[12px] text-muted-foreground">{t("Boshlangan: {date}", { date: settings.startDate.split("-").reverse().join(".") })}</span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {settings.enabled
              ? t("O'quvchilarga tanga yozilmoqda. O'chirilsa yangi tanga yozilmaydi, balanslar saqlanadi.")
              : t("O'chiq: hech kimga tanga yozilmaydi va bo'limni faqat direktor ko'radi. Hammasi tayyor bo'lgach yoqing.")}
          </p>
        </div>
        {canEdit && <Toggle on={settings.enabled} onChange={(on) => setPending({ kind: "enable", on })} />}
      </div>

      {!canEdit && (
        <div className="rounded-lg bg-secondary/60 px-3 py-2 text-[12.5px] text-muted-foreground">{t("Sozlamalarni faqat direktor o'zgartiradi — siz faqat ko'rasiz.")}</div>
      )}

      {/* Ikki ustun faqat juda keng ekranda: Sozlamalarning chap paneli
          320 px oladi va 1280 px da kartalar torayib, daraja nomi kesilardi. */}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <div className={cardCls}>
          <h3 className="mb-2 text-[15px] font-semibold">{t("Cheklovlar")}</h3>
          {num("dailyDeductionLimit", "Bir o'quvchidan bir kunda qo'lda ayirish — maksimum")}
          {num("objectionDays", "E'tiroz va «Sababli» muddati (admin uchun)", "kun")}
          {num("wishlistMax", "Istaklar ro'yxati — maksimum", "ta")}
          {num("monthCloseDay", "Oy yakuni: keyingi oyning nechanchi kuni", "-kuni")}
          <RuleNote>
            {t("Balans 0 dan pastga tushmaydi · ayirish darajani tushirmaydi · sabab bilan ayirishda izoh majburiy · davomat −{n} kunlik limitga kirmaydi", { n: settings.absencePenaltyCoins })}
          </RuleNote>
        </div>

        <div className={cardCls} key={levelsKey}>
          <h3 className="mb-1 text-[15px] font-semibold">{t("Darajalar (5 ta)")}</h3>
          <p className="mb-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("«Jami topilgan» tanga bo'yicha — sarflash va ayirish darajani tushirmaydi. Chegaralar o'sib borishi, nomlar takrorlanmasligi kerak; chegara o'zgarsa kimga ta'sir qilishi oldindan ko'rsatiladi.")}
          </p>
          {settings.levels.map((l, i) => (
            <LevelRow key={`${i}:${l.name}:${l.minEarned}`} level={l} index={i} disabled={!canEdit} onCommit={commitLevel} />
          ))}
        </div>

        <div className={cardCls}>
          <h3 className="mb-2 text-[15px] font-semibold">{t("Toifalar")}</h3>
          {num("kidsMaxGrade", "Kichiklar toifasi: shu sinfgacha (qolganlari — kattalar)", "-sinf")}
          <RuleNote>
            {t("Tangalar yil oxirida yonmaydi — yig'ilib boradi · ketgan o'quvchi tangalari muzlatiladi, qaytsa tiklanadi · o'quvchi filial almashtirsa, tangalar u bilan ko'chadi")}
          </RuleNote>
        </div>

        <div className={cardCls}>
          <h3 className="mb-1 text-[15px] font-semibold">{t("Tanga sabablari")}</h3>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("Tanga beriladigan va ayiriladigan barcha sabablar — miqdor, kim beradi, kunlik cheklov — alohida bo'limda: hozir {n} ta faol sabab.", { n: activeReasons })}
          </p>
          <Link
            href="/settings-gamification?tab=reasons"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary/10 px-4 text-sm font-medium text-primary hover:bg-primary/15"
          >
            {t("Tanga sabablari")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {pending && (
        <ConfirmModal
          pending={pending}
          settings={settings}
          busy={busy}
          onConfirm={confirmPending}
          onClose={() => {
            setPending(null);
            setLevelsKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

const LEVEL_TONES = [
  "bg-secondary text-muted-foreground",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-primary/10 text-primary",
  "bg-indigo-600 text-white",
  "bg-amber-400 text-slate-900",
];

function LevelRow({
  level,
  index,
  disabled,
  onCommit,
}: {
  level: GamLevel;
  index: number;
  disabled: boolean;
  onCommit: (index: number, field: "name" | "minEarned", raw: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const [name, setName] = useState(level.name);
  const [min, setMin] = useState(String(level.minEarned));
  return (
    <div className="flex items-center gap-2 border-b border-border/60 py-2 last:border-0">
      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${LEVEL_TONES[index]}`}>{index + 1}</span>
      <input
        aria-label={t("{n}-daraja nomi", { n: index + 1 })}
        value={name}
        maxLength={30}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        onBlur={async () => {
          if (name.trim() === level.name) return;
          if (!(await onCommit(index, "name", name))) setName(level.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
      />
      <input
        type="number"
        inputMode="numeric"
        step={1}
        aria-label={t("{n}-daraja chegarasi", { n: index + 1 })}
        value={min}
        disabled={disabled || index === 0}
        onChange={(e) => setMin(e.target.value)}
        onBlur={async () => {
          if (min.trim() === String(level.minEarned)) return;
          if (!(await onCommit(index, "minEarned", min))) setMin(String(level.minEarned));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={numCls}
      />
      <span className="w-12 text-[12px] text-muted-foreground">{t("tanga")}</span>
    </div>
  );
}
