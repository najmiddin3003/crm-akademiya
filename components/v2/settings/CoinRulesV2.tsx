"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Lock, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { gamApi } from "@/components/gamification/api";
import { DeleteReasonModal, ReasonFormModal, SystemReasonModal, customAmount, sysAmount } from "@/components/gamification/settings/ReasonsTab";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { ALLOWED_ROLE_LABELS, type CoinReason, type GamRole, type GamSettings, type SystemReasonCode } from "@/lib/gamification/types";

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
const LESSON_CODES: SystemReasonCode[] = ["activity", "homework_done", "homework_missed"];

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
  const [autoOpen, setAutoOpen] = useState(false);

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
  const lesson = [sys("activity"), sys("homework_done"), ...custom(1), sys("homework_missed"), ...custom(-1)].filter((r): r is CoinReason => !!r);
  const auto = reasons.filter((r) => r.isSystem && r.code && !LESSON_CODES.includes(r.code));

  const amountOf = (r: CoinReason) => (settings ? (r.isSystem ? sysAmount(r, settings, t) : customAmount(r)) : "");

  const row = (r: CoinReason) => {
    const plus = r.direction > 0;
    const menu: ActionMenuEntry[] = [
      { key: "h", heading: nameOf(r) },
      { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => (r.isSystem ? setSysEdit(r) : setForm({ reason: r, direction: r.direction })) },
      { key: "tog", label: r.isActive ? t("To'xtatish") : t("Yoqish"), icon: r.isActive ? Pause : Play, onSelect: () => void toggle(r) },
      ...(r.isSystem
        ? []
        : [{ key: "d", divider: true } as ActionMenuEntry, { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => setDel(r) } as ActionMenuEntry]),
    ];
    const meta = r.isSystem
      ? null
      : [t(ALLOWED_ROLE_LABELS[r.allowedRoles ?? "teacher"]), r.perDayLimit > 0 ? t("kuniga {n} marta", { n: r.perDayLimit }) : null, r.noteRequired ? t("izoh majburiy") : null]
          .filter(Boolean)
          .join(" · ");
    return (
      <tr key={r.id} className={`border-b border-v2-border last:border-b-0 ${r.isActive ? "" : "opacity-70"}`}>
        <td className="py-2.5 pl-4 pr-3">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-v2-small font-semibold text-v2-text">{nameOf(r)}</span>
            {r.isSystem && <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-label={t("Tizim qoidasi — o'chirilmaydi")} />}
          </span>
          {meta && <span className="mt-0.5 block truncate text-v2-caption text-v2-text-2">{meta}</span>}
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-flex rounded-v2-full px-2 py-0.5 text-v2-caption font-semibold tabular-nums ${plus ? "bg-v2-success-bg text-v2-success" : "bg-v2-danger-bg text-v2-danger"}`}>{amountOf(r)}</span>
        </td>
        <td className="px-3 py-2.5 text-v2-small text-v2-text">{plus ? t("Berish") : t("Ayirish")}</td>
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
            <span className={`size-1.5 rounded-full ${r.isActive ? "bg-v2-success" : "bg-v2-text-3"}`} aria-hidden />
            {r.isActive ? t("Faol") : t("To'xtatilgan")}
          </span>
        </td>
        <td className="py-2.5 pl-1 pr-3 text-right">
          {canEdit && (
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => (r.isSystem ? setSysEdit(r) : setForm({ reason: r, direction: r.direction }))}
                title={t("Tahrirlash")}
                aria-label={t("{name} — tahrirlash", { name: nameOf(r) })}
                className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <Pencil className="size-4" strokeWidth={1.75} />
              </button>
              <ActionMenu items={menu} label={t("{name} — amallar", { name: nameOf(r) })} width={220}>
                {(trigger, open) => (
                  <button
                    type="button"
                    {...trigger}
                    title={t("Amallar")}
                    aria-label={t("{name} — amallar", { name: nameOf(r) })}
                    className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : ""}`}
                  >
                    <MoreHorizontal className="size-4" strokeWidth={1.75} />
                  </button>
                )}
              </ActionMenu>
            </span>
          )}
        </td>
      </tr>
    );
  };

  const table = (rows: CoinReason[], withAdd: boolean) => (
    <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
      <div className="relative overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[36rem] border-collapse text-v2-small">
          <colgroup>
            <col />
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[130px]" />
            <col className="w-[84px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} pl-4`}>{t("Qoida")}</th>
              <th className={th}>{t("Tanga")}</th>
              <th className={th}>{t("Turi")}</th>
              <th className={th}>{t("Holat")}</th>
              <th className={`${th} pr-3`}>
                <span className="sr-only">{t("Amallar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!settings &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={`sk${i}`} className="h-[48px] border-b border-v2-border" aria-hidden>
                  <td className="pl-4 pr-3">
                    <div className="h-3 w-40 rounded bg-v2-skeleton" />
                  </td>
                  <td className="px-3">
                    <div className="h-5 w-10 rounded bg-v2-skeleton" />
                  </td>
                  <td className="px-3">
                    <div className="h-3 w-14 rounded bg-v2-skeleton" />
                  </td>
                  <td className="px-3">
                    <div className="h-3 w-12 rounded bg-v2-skeleton" />
                  </td>
                  <td />
                </tr>
              ))}
            {settings && rows.map(row)}
          </tbody>
        </table>
      </div>
      {withAdd && canEdit && settings && (
        <div className="p-2">
          <button
            type="button"
            onClick={() => setForm({ reason: null, direction: 1 })}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-v2-md border border-dashed border-v2-border-strong text-v2-small font-semibold text-v2-brand-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Yangi qoida qo'shish")}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Gamifikatsiya")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Tanga qoidalari")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("O'qituvchi darsda tanga berganda shu ro'yxatdan tanlaydi. Qoida nomi va miqdori o'zgarsa, keyingi berilgan tangalarga ta'sir qiladi — oldingilari o'zgarmaydi.")}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setForm({ reason: null, direction: 1 })} className={primaryBtn}>
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            {t("Qoida qo'shish")}
          </button>
        )}
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
        <>
          {/* 2. Dars qoidalari */}
          {table(lesson, true)}

          {/* 3. Avtomatik tangalar (yig'iq) */}
          {settings && auto.length > 0 && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <button
                type="button"
                onClick={() => setAutoOpen((o) => !o)}
                aria-expanded={autoOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                <span className="min-w-0">
                  <span className="block text-v2-section text-v2-text">
                    {t("Avtomatik tangalar")} <span className="text-v2-small font-normal text-v2-text-3">{auto.length}</span>
                  </span>
                  <span className="block text-v2-caption text-v2-text-2">{t("Davomat, uzluksiz davomat, Sarhisob va do'st bonusi — tizim o'zi yozadi.")}</span>
                </span>
                <ChevronDown className={`size-4 shrink-0 text-v2-text-3 transition-transform ${autoOpen ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
              </button>
              {autoOpen && <div className="border-t border-v2-border p-3">{table(auto, false)}</div>}
            </section>
          )}

          {/* 4. Reyting izohi */}
          <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
            <h2 className="text-v2-section text-v2-text">{t("Reyting")}</h2>
            <p className="mt-1 text-v2-small text-v2-text-2">
              {t("Ikki xil reyting bor:")} <b className="font-semibold text-v2-text">{t("oylik")}</b> — {t("shu oy olingan tangalar, har oyning 1-sanasida noldan boshlanadi;")}{" "}
              <b className="font-semibold text-v2-text">{t("umumiy")}</b> — {t("o'quvchining hozirgi tanga balansi. O'quvchi ikkalasini ham o'z kabinetida ko'radi.")}
            </p>
          </section>

          <Link
            href="/settings-gamification?tab=general"
            className="inline-flex items-center gap-1.5 self-start text-v2-small text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline"
          >
            <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("Modul, darajalar, do'kon va byudjet sozlamalari — eski ko'rinishda")}
          </Link>
        </>
      )}

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
