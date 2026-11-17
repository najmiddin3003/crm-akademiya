"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, RefreshCw, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import { DeleteReasonModal, ReasonFormModal, SystemReasonModal, customAmount, sysAmount } from "@/components/gamification/settings/ReasonsTab";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ALLOWED_ROLE_LABELS, SYSTEM_REASONS, type CoinReason, type GamRole, type GamSettings, type SystemReasonCode } from "@/lib/gamification/types";

// 33-qism (17.11.2026, rasm «Sozlamalar · Tanga sabablari»): bitta jadval — «Tanga beriladi» va
// «Tanga ayiriladi» guruhlari; ustunlar Sabab (🔒 tizim, «izoh majburiy»), Tanga, Kim beradi,
// Cheklov, Faol (almashtirgich), ✎ va o'chirish (tizim sababida o'chiq).
//
// YANGI VERSIYA — SOZLAMALAR → GAMIFIKATSIYA → TANGA QOIDALARI (rasm «Sozlamalar · Tanga
// qoidalari», yorug'/qorong'i, 24.10.2026). Jadvaldagi qoidalar — ustoz darsda tanga
// berganda tanlaydigan ro'yxat (guruh sahifasidagi «Tanga berish» oynasi bilan bir xil
// tartib): faollik, uy vazifasi bajardi, beriladigan sabablar, uy vazifasi bajarilmadi,
// ayiriladigan sabablar. Avtomatik tangalar (davomat, seriya, Sarhisob, do'st) — yig'iq
// bo'limda. Tahrirlash oynalari — eski (components/gamification/settings/ReasonsTab.tsx),
// o'zgartirish — faqat direktor (server ham tekshiradi).

/** Dars qoidalari — rasmdagi nomlar (guruh sahifasidagi tanga oynasi bilan bir xil). */
const LESSON_LABEL: Partial<Record<SystemReasonCode, string>> = {
  activity: "Darsda faol qatnashdi",
  homework_done: "Uy vazifasini bajardi",
  homework_missed: "Uy vazifasi bajarilmadi",
};

const th = "whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-left text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

export default function CoinRulesV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const [settings, setSettings] = useState<GamSettings | null>(null);
  const [reasons, setReasons] = useState<CoinReason[]>([]);
  const [role, setRole] = useState<GamRole | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [sysEdit, setSysEdit] = useState<CoinReason | null>(null);
  const [form, setForm] = useState<{ reason: CoinReason | null; direction: 1 | -1 } | null>(null);
  const [del, setDel] = useState<CoinReason | null>(null);

  useEffect(() => {
    let off = false;
    Promise.all([
      gamApi<{ settings: GamSettings; role: GamRole }>("/api/gamification/settings"),
      gamApi<{ reasons: CoinReason[] }>("/api/gamification/reasons"),
    ]).then(([s, r]) => {
      if (off) return;
      if (!s.ok) {
        setErr(s.error);
        return;
      }
      setErr("");
      setSettings(s.settings);
      setRole(s.role);
      if (r.ok) setReasons(r.reasons);
    });
    return () => {
      off = true;
    };
  }, [version]);
  const reload = useCallback(async () => setVersion((v) => v + 1), []);

  const canEdit = role === "director";
  const nameOf = (r: CoinReason) => (r.code && LESSON_LABEL[r.code] ? t(LESSON_LABEL[r.code] as string) : r.isSystem ? t(r.name) : r.name);

  async function toggle(r: CoinReason) {
    const res = await gamApi<{ reason: CoinReason; streakRuleChanged: boolean }>(`/api/gamification/reasons/${r.id}/active`, { method: "PATCH", body: { isActive: !r.isActive } });
    if (!res.ok) {
      showError(t(res.error));
      return;
    }
    setReasons((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: res.reason.isActive } : x)));
    const name = nameOf(r);
    if (res.streakRuleChanged) showSuccess(t("«{name}» yoqildi — yangi qoida bugundan qo'llanadi", { name }));
    else showSuccess(res.reason.isActive ? t("«{name}» yoqildi", { name }) : t("«{name}» to'xtatildi", { name }));
  }

  const sys = (code: SystemReasonCode) => reasons.find((r) => r.code === code);
  const custom = (d: 1 | -1) => reasons.filter((r) => !r.isSystem && r.direction === d);
  const PLUS_SYS: SystemReasonCode[] = ["attendance", "homework_done", "activity", "exam_result", "growth", "streak", "referral"];
  const MINUS_SYS: SystemReasonCode[] = ["absence", "homework_missed"];
  const plusRows = [...PLUS_SYS.map(sys), ...custom(1)].filter((r): r is CoinReason => !!r);
  const minusRows = [...MINUS_SYS.map(sys), ...custom(-1)].filter((r): r is CoinReason => !!r);
  const activeCount = reasons.filter((r) => r.isActive).length;

  const amountOf = (r: CoinReason) => (settings ? (r.isSystem ? sysAmount(r, settings, t) : customAmount(r)) : "");
  const whoOf = (r: CoinReason) => (r.isSystem ? t(SYSTEM_REASONS.find((x) => x.code === r.code)?.who ?? "") : t(ALLOWED_ROLE_LABELS[r.allowedRoles ?? "teacher"]));
  const limitOf = (r: CoinReason): string => {
    if (!settings) return "";
    if (r.isSystem) {
      switch (r.code) {
        case "activity":
          return t("guruhga darsda {n}", { n: settings.activityGroupLimitPerLesson });
        case "exam_result":
          return t("oyiga 1 marta");
        case "growth":
          return t("+{n} f.p. o'sganda", { n: settings.growthThresholdPp });
        case "streak":
          return t("har {n} dars", { n: settings.streakLessons });
        case "referral":
          return t("do'st to'lov qilgach");
        case "absence":
          return t("limitdan tashqari");
        default:
          return "—";
      }
    }
    if (r.perDayLimit > 0) return t("kuniga {n} marta", { n: r.perDayLimit });
    return r.direction < 0 ? t("kunlik limit ichida") : t("cheklovsiz");
  };

  const iconBtn =
    "inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-35";

  const row = (r: CoinReason) => {
    const plus = r.direction > 0;
    return (
      <tr key={r.id} className="border-b border-v2-border">
        <td className="py-3 pl-5 pr-3">
          <span className={`flex flex-wrap items-center gap-2 ${r.isActive ? "" : "opacity-60"}`}>
            {r.isSystem && <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-label={t("Tizim sababi — o'chirilmaydi")} />}
            <span className="font-semibold text-v2-text">{nameOf(r)}</span>
            {!r.isSystem && r.noteRequired && <span className="rounded-v2-sm bg-v2-warning-bg px-1.5 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("izoh majburiy")}</span>}
          </span>
        </td>
        <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums ${r.isActive ? (plus ? "text-v2-success" : "text-v2-danger") : "text-v2-text-3"}`}>{amountOf(r)}</td>
        <td className="px-3 py-3 text-v2-text-2">{whoOf(r)}</td>
        <td className="px-3 py-3 text-v2-text-2">{limitOf(r)}</td>
        <td className="px-3 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={r.isActive}
            aria-label={t("{name} — faol", { name: nameOf(r) })}
            disabled={!canEdit}
            onClick={() => void toggle(r)}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${r.isActive ? "bg-v2-brand" : "bg-v2-border-strong"}`}
          >
            <span className={`absolute top-0.5 size-5 rounded-full bg-v2-surface shadow transition-all ${r.isActive ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </td>
        <td className="py-3 pl-1 pr-5">
          {canEdit && (
            <span className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => (r.isSystem ? setSysEdit(r) : setForm({ reason: r, direction: r.direction }))}
                title={t("Tahrirlash")}
                aria-label={t("{name} — tahrirlash", { name: nameOf(r) })}
                className={iconBtn}
              >
                <Pencil className="size-4" strokeWidth={1.75} />
              </button>
              <button type="button" disabled={r.isSystem} onClick={() => setDel(r)} title={r.isSystem ? t("Tizim sababi — o'chirilmaydi") : t("O'chirish")} aria-label={t("{name} — o'chirish", { name: nameOf(r) })} className={iconBtn}>
                <Trash2 className="size-4" strokeWidth={1.75} />
              </button>
            </span>
          )}
        </td>
      </tr>
    );
  };

  const groupRow = (label: string, list: CoinReason[], dot: string) => {
    const off = list.filter((r) => !r.isActive).length;
    return (
      <tr className="border-b border-v2-border">
        <td colSpan={6} className="px-5 py-3">
          <span className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${dot}`} aria-hidden />
            <b className="text-v2-body font-semibold text-v2-text">{label}</b>
            <span className="text-v2-small text-v2-text-2">
              {t("{n} ta sabab", { n: list.length })}
              {off > 0 ? ` · ${t("{n} tasi to'xtatilgan", { n: off })}` : ""}
            </span>
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[48rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Gamifikatsiya")}</div>
          <h1 className="mt-0.5 text-[24px] font-semibold leading-8 text-v2-text">{t("Tanga sabablari")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">{t("{n} ta faol sabab · ustoz va admin «± Sabab» tugmasi orqali shu ro'yxatdan tanlaydi", { n: activeCount })}</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setForm({ reason: null, direction: 1 })} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Sabab qo'shish")}
          </button>
        )}
      </div>

      <div className="flex gap-3 rounded-v2-lg bg-v2-info-bg px-4 py-3 text-v2-small text-v2-text">
        <Lock className="mt-0.5 size-4 shrink-0 text-v2-info" strokeWidth={1.75} aria-hidden />
        <span>
          <b className="font-semibold">{t("Tizim sabablari")}</b>{" "}
          {t("davomat, uy vazifasi tugmalari va Sarhisobga bog'langan: nomi o'zgarmaydi va o'chirilmaydi, lekin miqdorini tahrirlash va vaqtincha to'xtatish mumkin. Qo'shimcha sabablarni to'liq boshqarasiz.")}
        </span>
      </div>

      {err ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(err)}</p>
          <button type="button" onClick={() => void reload()} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-v2-small">
              <thead>
                <tr>
                  <th className={`${th} pl-5`}>{t("Sabab")}</th>
                  <th className={`${th} text-right`}>{t("Tanga")}</th>
                  <th className={th}>{t("Kim beradi")}</th>
                  <th className={th}>{t("Cheklov")}</th>
                  <th className={th}>{t("Faol")}</th>
                  <th className={`${th} pr-5`}>
                    <span className="sr-only">{t("Amallar")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!settings ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={`sk${i}`} className="h-[52px] border-b border-v2-border" aria-hidden>
                      <td className="pl-5 pr-3" colSpan={6}>
                        <div className="h-3 w-64 rounded bg-v2-skeleton" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    {groupRow(t("Tanga beriladi"), plusRows, "bg-v2-success")}
                    {plusRows.map(row)}
                    {groupRow(t("Tanga ayiriladi"), minusRows, "bg-v2-danger")}
                    {minusRows.map(row)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link href="/settings-gamification?tab=general" className="inline-flex items-center gap-1.5 self-start text-v2-small text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline">
        <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("Modul, cheklovlar va darajalar — Tanga tizimi")}
      </Link>

      {/* ── Oynalar (eski) ── */}
      {sysEdit && settings && (
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
      {form && settings && (
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
