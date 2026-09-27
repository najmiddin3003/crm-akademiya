"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Segmented from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import { Toggle } from "@/components/settings/SettingsForm";
import { gamApi } from "../api";
import { intIn } from "@/lib/gamification/rules";
import {
  ALLOWED_ROLE_LABELS,
  NUMERIC_SETTINGS,
  PER_DAY_LIMITS,
  SYSTEM_REASONS,
  type CoinReason,
  type GamRole,
  type GamSettings,
  type ReasonAllowedRoles,
} from "@/lib/gamification/types";

// Sozlamalar → Gamifikatsiya → Tanga sabablari (TZ 4.4, 4.9, 5.7;
// prototipdagi «Tanga sabablari»). Ikki jadval — «Tanga beriladi» va
// «Tanga ayiriladi». Tizim sabablari 🔒: miqdorini tahrirlash va
// yoqish/to'xtatish mumkin, o'chirilmaydi. Qo'shimcha sabablar to'liq
// boshqariladi. O'zgartirish — faqat direktor (server ham tekshiradi).

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60";
const btnPrimary = "inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60";
const btnGhost = "inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60";
const iconBtn =
  "gm-tap inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35";

const SYS = new Map(SYSTEM_REASONS.map((s) => [s.code, s]));

/** Maydon ostidagi xato (TZ 5.0) — matn chaqiruvchida o'girilgan. */
function FieldError({ text }: { text: string }) {
  return text ? (
    <div role="alert" className="mt-1 text-[12px] font-medium text-rose-600">
      {text}
    </div>
  ) : null;
}

/** Tizim sababining miqdor ko'rinishi — sozlamalardan. */
function sysAmount(r: CoinReason, s: GamSettings, t: (k: string, p?: Record<string, string | number>) => string): string {
  switch (r.code) {
    case "attendance":
      return `+${s.attendanceOnTimeCoins} / +${s.attendanceLateCoins}`;
    case "homework_done":
      return `+${s.homeworkDoneCoins}`;
    case "activity":
      return `+1…+${s.activityMaxPerClick}`;
    case "exam_result":
      return `+${s.examCoins70}…+${s.examCoins90}`;
    case "growth":
      return `+${s.growthBonusCoins} ${t("(≥{n} f.p.)", { n: s.growthThresholdPp })}`;
    case "streak":
      return `+${s.streakBonusCoins} ${t("({n} dars)", { n: s.streakLessons })}`;
    case "referral":
      return `+${s.referralBonusCoins}`;
    case "absence":
      return `−${s.absencePenaltyCoins}`;
    case "homework_missed":
      return `−${s.homeworkMissedPenalty}`;
    default:
      return "";
  }
}

function customAmount(r: CoinReason): string {
  const sign = r.direction > 0 ? "+" : "−";
  return r.amountMin === r.amountMax ? `${sign}${r.amountMin}` : `${sign}${r.amountMin}…${sign}${r.amountMax}`;
}

export default function GamReasonsTab() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<GamSettings | null>(null);
  const [reasons, setReasons] = useState<CoinReason[]>([]);
  const [role, setRole] = useState<GamRole | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sysEdit, setSysEdit] = useState<CoinReason | null>(null);
  const [form, setForm] = useState<{ reason: CoinReason | null; direction: 1 | -1 } | null>(null);
  const [del, setDel] = useState<CoinReason | null>(null);

  const reload = useCallback(async () => {
    const [s, r] = await Promise.all([
      gamApi<{ settings: GamSettings; role: GamRole }>("/api/gamification/settings"),
      gamApi<{ reasons: CoinReason[] }>("/api/gamification/reasons"),
    ]);
    if (!s.ok) {
      setLoadError(s.error);
      return;
    }
    setSettings(s.settings);
    setRole(s.role);
    if (r.ok) setReasons(r.reasons);
  }, []);

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
      if (r.ok) setReasons(r.reasons);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canEdit = role === "director";

  async function toggle(r: CoinReason) {
    const res = await gamApi<{ reason: CoinReason; streakRuleChanged: boolean }>(`/api/gamification/reasons/${r.id}/active`, {
      method: "PATCH",
      body: { isActive: !r.isActive },
    });
    if (!res.ok) {
      showError(t(res.error));
      return;
    }
    setReasons((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: res.reason.isActive } : x)));
    const name = r.isSystem ? t(r.name) : r.name;
    if (res.streakRuleChanged) showSuccess(t("«{name}» yoqildi — yangi qoida bugundan qo'llanadi", { name }));
    else showSuccess(res.reason.isActive ? t("«{name}» yoqildi", { name }) : t("«{name}» to'xtatildi", { name }));
  }

  if (loadError) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">{t(loadError)}</div>;
  }
  if (!settings) return <SpinnerBlock size={22} />;

  const card = (d: 1 | -1) => {
    const rows = reasons.filter((r) => r.direction === d);
    const custom = rows.filter((r) => !r.isSystem);
    return (
      <div className="gm-scroll-card rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${d > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
            {d > 0 ? t("Tanga beriladi") : t("Tanga ayiriladi")}
            <span className="text-[12px] font-normal text-muted-foreground">· {t("{n} ta sabab", { n: rows.length })}</span>
          </h3>
          {canEdit && (
            <button type="button" className={btnPrimary} onClick={() => setForm({ reason: null, direction: d })}>
              <Plus className="h-4 w-4" /> {t("Sabab qo'shish")}
            </button>
          )}
        </div>
        <div className="table-box">
          <table className="gm-table">
            <thead>
              <tr>
                <th>{t("Sabab")}</th>
                <th>{t("Tanga")}</th>
                <th>{t("Kim beradi")}</th>
                <th>{t("Bir o'quvchiga")}</th>
                <th>{t("Faol")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sys = r.code ? SYS.get(r.code) : undefined;
                return (
                  <tr key={r.id} className={r.isActive ? "" : "gm-off"}>
                    <td className="gm-lead" data-l="">
                      <span className="font-semibold">{r.isSystem ? t(r.name) : r.name}</span>{" "}
                      {r.isSystem ? (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          <Lock className="h-3 w-3" /> {t("Tizim")}
                        </span>
                      ) : (
                        r.noteRequired && (
                          <span className="ml-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{t("izoh majburiy")}</span>
                        )
                      )}
                      {!r.isSystem && (r.usedCount ?? 0) > 0 && (
                        <div className="text-[12px] text-muted-foreground">{t("{n} marta ishlatilgan", { n: r.usedCount ?? 0 })}</div>
                      )}
                    </td>
                    <td data-l={t("Tanga")}>
                      <span className={`whitespace-nowrap ${d > 0 ? "gm-pos" : "gm-neg"}`}>{r.isSystem ? sysAmount(r, settings, t) : customAmount(r)}</span>
                    </td>
                    <td data-l={t("Kim beradi")}>
                      <span className="text-[12.5px] text-muted-foreground">
                        {r.isSystem ? t(sys?.who ?? "") : t(ALLOWED_ROLE_LABELS[r.allowedRoles as ReasonAllowedRoles] ?? "")}
                      </span>
                    </td>
                    <td data-l={t("Bir o'quvchiga")}>
                      <span className="text-[12.5px] text-muted-foreground">
                        {r.isSystem ? "—" : r.perDayLimit ? t("kuniga {n} marta", { n: r.perDayLimit }) : t("cheklovsiz")}
                      </span>
                    </td>
                    <td data-l={t("Faol")} className="gm-keep">
                      {canEdit ? (
                        <Toggle on={r.isActive} onChange={() => toggle(r)} />
                      ) : (
                        <span className="text-[12.5px]">{r.isActive ? t("Ha") : t("Yo'q")}</span>
                      )}
                    </td>
                    <td data-l="" className="gm-keep">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className={`${iconBtn} text-primary`}
                            title={t("Tahrirlash")}
                            aria-label={t("Tahrirlash")}
                            onClick={() => (r.isSystem ? setSysEdit(r) : setForm({ reason: r, direction: r.direction }))}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={`${iconBtn} hover:text-rose-600`}
                            disabled={r.isSystem}
                            title={r.isSystem ? t("Tizim sababini o'chirib bo'lmaydi — to'xtatish mumkin") : t("O'chirish")}
                            aria-label={t("O'chirish")}
                            onClick={() => setDel(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {custom.length === 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">{t("Qo'shimcha sabab yo'q — «Sabab qo'shish» bilan qo'shing.")}</p>}
      </div>
    );
  };

  return (
    <div className="gm-page space-y-4">
      <div>
        <h1 className="text-[17px] font-semibold">{t("Tanga sabablari")}</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {t("Faqat direktor o'zgartiradi. O'zgarish darhol kuchga kiradi va keyingi yozuvlarga qo'llanadi — o'tgan yozuvlar o'zgarmaydi.")}
        </p>
      </div>
      <div className="rounded-xl bg-primary/10 px-4 py-3 text-[13px] leading-relaxed text-primary">
        🔒 <b>{t("Tizim sabablari")}</b>{" "}
        {t("avtomatik jarayonga bog'langan (davomat, uy vazifasi tugmalari, Sarhisob…): nomi o'zgarmaydi va o'chirilmaydi, lekin miqdorini tahrirlash va vaqtincha to'xtatish mumkin.")}{" "}
        <b>{t("Qo'shimcha sabablar")}</b>{" "}
        {t("to'liq boshqariladi — ustoz va admin ularni «Tanga berish» sahifasidagi «± Sabab» tugmasi orqali, admin va direktor esa o'quvchi profili orqali ham ishlatadi.")}
      </div>
      {card(1)}
      {card(-1)}

      {sysEdit && (
        <SystemReasonModal
          reason={sysEdit}
          settings={settings}
          onClose={() => setSysEdit(null)}
          onSaved={async (msg) => {
            await reload();
            showSuccess(msg);
          }}
        />
      )}
      {form && (
        <ReasonFormModal
          reason={form.reason}
          direction={form.direction}
          dailyLimit={settings.dailyDeductionLimit}
          onClose={() => setForm(null)}
          onDelete={(r) => {
            setForm(null);
            setDel(r);
          }}
          onSaved={async (msg) => {
            await reload();
            showSuccess(msg);
          }}
        />
      )}
      {del && (
        <DeleteReasonModal
          reason={del}
          onClose={() => setDel(null)}
          onDeleted={async () => {
            const name = del.name;
            await reload();
            showSuccess(t("«{name}» o'chirildi", { name }));
          }}
        />
      )}
    </div>
  );
}

// ── Tizim sababi oynasi: miqdor maydonlari + yoqilgan ────────────────────

function SystemReasonModal({
  reason,
  settings,
  onClose,
  onSaved,
}: {
  reason: CoinReason;
  settings: GamSettings;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const sys = SYS.get(reason.code!)!;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(sys.fields.map((f) => [f.key, String(settings[f.key])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [active, setActive] = useState(reason.isActive);
  const [busy, setBusy] = useState(false);

  async function save() {
    const errs: Record<string, string> = {};
    const patch: Record<string, number> = {};
    for (const f of sys.fields) {
      const [lo, hi] = NUMERIC_SETTINGS[f.key];
      const v = intIn(values[f.key], lo, hi);
      if (v === null) errs[f.key] = t("{lo}–{hi} oralig'ida butun son bo'lsin", { lo, hi });
      else if (v !== settings[f.key]) patch[f.key] = v;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    let streakChanged = false;
    if (Object.keys(patch).length) {
      const res = await gamApi<{ streakRuleChanged: boolean }>("/api/gamification/settings", { method: "PUT", body: patch });
      if (!res.ok) {
        showError(t(res.error));
        setBusy(false);
        return;
      }
      streakChanged = res.streakRuleChanged;
    }
    if (active !== reason.isActive) {
      const res = await gamApi<{ streakRuleChanged: boolean }>(`/api/gamification/reasons/${reason.id}/active`, {
        method: "PATCH",
        body: { isActive: active },
      });
      if (!res.ok) {
        showError(t(res.error));
        setBusy(false);
        return;
      }
      streakChanged ||= res.streakRuleChanged;
    }
    await onSaved(streakChanged ? t("Saqlandi · yangi qoida bugundan qo'llanadi") : t("Saqlandi"));
    modal.close();
  }

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" panelClassName="overflow-y-auto">
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">{t(reason.name)}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
            <Lock className="h-3 w-3" /> {t("Tizim sababi")}
          </span>
          · {t(sys.who)} · {reason.direction > 0 ? t("tanga beriladi") : t("tanga ayiriladi")}
        </p>
        <div className="mt-4 space-y-3">
          {sys.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`sf_${f.key}`} className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t(f.label)}
              </label>
              <input
                id={`sf_${f.key}`}
                type="number"
                inputMode="numeric"
                step={1}
                value={values[f.key]}
                aria-invalid={!!errors[f.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setErrors((er) => ({ ...er, [f.key]: "" }));
                }}
                className={inputCls}
              />
              <FieldError text={errors[f.key] ?? ""} />
            </div>
          ))}
          {reason.code === "streak" && (
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {t("Darslar sonini o'zgartirsangiz yangi qoida bugundan qo'llanadi: avval berilgan bonuslar o'zgarmaydi, o'quvchilarning joriy seriyasi uzilmaydi.")}
            </p>
          )}
          <label className="flex cursor-pointer items-start gap-2 text-[13px] font-medium">
            <input type="checkbox" className="mt-0.5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>
              {reason.direction > 0
                ? t("Yoqilgan — to'xtatilsa bu sabab bo'yicha tanga berilmaydi")
                : t("Yoqilgan — to'xtatilsa bu sabab bo'yicha tanga ayirilmaydi")}
            </span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Qo'shimcha sabab oynasi: qo'shish / tahrirlash ──────────────────────

function ReasonFormModal({
  reason,
  direction: initialDir,
  dailyLimit,
  onClose,
  onDelete,
  onSaved,
}: {
  reason: CoinReason | null;
  direction: 1 | -1;
  dailyLimit: number;
  onClose: () => void;
  onDelete: (r: CoinReason) => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const { t } = useT();
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const [dir, setDir] = useState<1 | -1>(reason?.direction ?? initialDir);
  const [name, setName] = useState(reason?.name ?? "");
  const [mode, setMode] = useState<"fix" | "range">(reason && reason.amountMin !== reason.amountMax ? "range" : "fix");
  const [min, setMin] = useState(reason?.amountMin != null ? String(reason.amountMin) : "");
  const [max, setMax] = useState(reason && reason.amountMin !== reason.amountMax && reason.amountMax != null ? String(reason.amountMax) : "");
  const [who, setWho] = useState<ReasonAllowedRoles>(reason?.allowedRoles ?? "teacher");
  const [perDay, setPerDay] = useState(String(reason?.perDayLimit ?? 0));
  const [note, setNote] = useState(reason?.noteRequired ?? initialDir < 0);
  const [active, setActive] = useState(reason?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const cap = dir < 0 ? dailyLimit : 1000;
  const noteForced = dir < 0;

  async function save() {
    const errs: Record<string, string> = {};
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) errs.name = t("Sabab nomini yozing");
    const mn = intIn(min, 1, cap);
    if (mn === null) errs.min = t("Miqdor 1–{cap} oralig'ida butun son bo'lsin", { cap });
    let mx = mn;
    if (mode === "range" && mn !== null) {
      mx = intIn(max, mn + 1, cap);
      if (mx === null) errs.max = t("Maksimum {amountMin}–{cap} oralig'ida butun son bo'lsin", { amountMin: mn + 1, cap });
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = {
      name: n,
      direction: dir,
      amountMin: mn,
      amountMax: mx,
      allowedRoles: who,
      perDayLimit: Number(perDay),
      noteRequired: noteForced ? true : note,
      isActive: active,
    };
    const res = reason
      ? await gamApi<{ renamed: boolean }>(`/api/gamification/reasons/${reason.id}`, { method: "PUT", body })
      : await gamApi<object>("/api/gamification/reasons", { method: "POST", body });
    if (!res.ok) {
      showError(t(res.error));
      setBusy(false);
      return;
    }
    const renamed = reason && "renamed" in res && res.renamed;
    await onSaved(reason ? (renamed ? t("Saqlandi · eski yozuvlar avvalgi nomi bilan qoladi") : t("Saqlandi")) : t("Sabab qo'shildi"));
    modal.close();
  }

  const whoOptions = (Object.keys(ALLOWED_ROLE_LABELS) as ReasonAllowedRoles[]).map((k) => ({ value: k, label: ALLOWED_ROLE_LABELS[k] }));
  const dayOptions = PER_DAY_LIMITS.map((d) => ({ value: String(d), label: d === 0 ? "Cheklovsiz" : t("{n} martagacha", { n: d }) }));

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="lg" panelClassName="overflow-y-auto">
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">{reason ? t("Sababni tahrirlash") : t("Yangi sabab")}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t("Ustoz yoki admin shu sabab bo'yicha o'quvchiga tanga beradi yoki ayiradi.")}</p>
        <div className="mt-4 space-y-3.5">
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Yo'nalish")}</span>
            <Segmented
              value={String(dir)}
              onChange={(v) => {
                const d = Number(v) as 1 | -1;
                setDir(d);
                if (d < 0) setNote(true);
              }}
              options={[
                { value: "1", label: "➕ Tanga beriladi" },
                { value: "-1", label: "➖ Tanga ayiriladi" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="reName" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {t("Sabab nomi")} *
            </label>
            <input
              id="reName"
              value={name}
              maxLength={80}
              aria-invalid={!!errors.name}
              placeholder={dir > 0 ? t("Masalan: Olimpiadada g'olib bo'ldi") : t("Masalan: Darsga kechikib, xalaqit berdi")}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((er) => ({ ...er, name: "" }));
              }}
              className={inputCls}
            />
            <FieldError text={errors.name ?? ""} />
          </div>
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Miqdor")}</span>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as "fix" | "range")}
              options={[
                { value: "fix", label: "Aniq" },
                { value: "range", label: "Oraliq (min–max)" },
              ]}
            />
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="reMin" className="mb-1 block text-[12px] text-muted-foreground">
                  {mode === "range" ? t("Minimum") : t("Miqdor")}
                </label>
                <input
                  id="reMin"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={min}
                  aria-invalid={!!errors.min}
                  onChange={(e) => {
                    setMin(e.target.value);
                    setErrors((er) => ({ ...er, min: "" }));
                  }}
                  className={inputCls}
                />
                <FieldError text={errors.min ?? ""} />
              </div>
              {mode === "range" && (
                <div>
                  <label htmlFor="reMax" className="mb-1 block text-[12px] text-muted-foreground">
                    {t("Maksimum")}
                  </label>
                  <input
                    id="reMax"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={max}
                    aria-invalid={!!errors.max}
                    onChange={(e) => {
                      setMax(e.target.value);
                      setErrors((er) => ({ ...er, max: "" }));
                    }}
                    className={inputCls}
                  />
                  <FieldError text={errors.max ?? ""} />
                </div>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {mode === "range" ? t("Xodim har safar shu oraliqdan o'zi tanlaydi.") : t("Har safar aynan shu miqdor yoziladi.")}
              {dir < 0 && <> {t("Ayirishda maksimum — kunlik limit ({n}).", { n: dailyLimit })}</>}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Kim beradi")}</span>
              <Select value={who} onChange={(v) => setWho(v as ReasonAllowedRoles)} options={whoOptions} size="md" />
            </div>
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Bir o'quvchiga kuniga")}</span>
              <Select value={perDay} onChange={(v) => setPerDay(v)} options={dayOptions} size="md" />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[13px] font-medium">
            <input type="checkbox" className="mt-0.5" checked={noteForced || note} disabled={noteForced} onChange={(e) => setNote(e.target.checked)} />
            <span>{noteForced ? t("Izoh yozish majburiy (ayirishda har doim)") : t("Izoh yozish majburiy")}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[13px] font-medium">
            <input type="checkbox" className="mt-0.5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>{t("Yoqilgan (to'xtatilsa tanlash ro'yxatida chiqmaydi, tarix saqlanadi)")}</span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {reason && (
            <button type="button" className={`${btnGhost} mr-auto text-rose-600`} onClick={() => onDelete(reason)} disabled={busy}>
              {t("O'chirish")}
            </button>
          )}
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : reason ? t("Saqlash") : t("Qo'shish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── O'chirish tasdig'i ───────────────────────────────────────────────────

function DeleteReasonModal({ reason, onClose, onDeleted }: { reason: CoinReason; onClose: () => void; onDeleted: () => Promise<void> }) {
  const { t } = useT();
  const { showError } = useToast();
  const modal = useModalClose(onClose);
  const [busy, setBusy] = useState(false);
  const used = reason.usedCount ?? 0;

  async function remove() {
    setBusy(true);
    const res = await gamApi<object>(`/api/gamification/reasons/${reason.id}`, { method: "DELETE" });
    if (!res.ok) {
      showError(t(res.error));
      setBusy(false);
      return;
    }
    await onDeleted();
    modal.close();
  }

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" panelClassName="overflow-y-auto">
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">{t("Sababni o'chirish")}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{t("«{name}» ro'yxatdan olib tashlanadi.", { name: reason.name })}</p>
        {used > 0 && (
          <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-[13px] text-primary">
            {t("Bu sabab {n} marta ishlatilgan — o'quvchilar tarixidagi yozuvlar va tangalar o'zgarmaydi.", { n: used })}
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-muted-foreground">{t("Vaqtincha to'xtatmoqchi bo'lsangiz, o'chirish o'rniga «Faol» tugmasi bilan to'xtating.")}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" onClick={remove} disabled={busy} className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
            {busy ? t("O'chirilmoqda…") : t("O'chirish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
