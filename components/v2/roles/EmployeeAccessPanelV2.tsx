"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleMinus, CirclePlus, History, Info, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT, type TFn } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { ToneBadge, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { FieldError, FieldHint, FieldLabel, Segmented, TextInput, fieldCls } from "@/components/v2/form/fields";
import V2Select from "@/components/v2/ui/V2Select";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { branchPool } from "@/lib/branchPools";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import { GRANTABLE_ROWS, accessDiff, rowState, type AccessRow } from "@/lib/accessRows";
import { REASON_MAX, latestReasonFor, type AccessNote, type HistoryItem } from "@/lib/accessOverride";
import { LevelChip, levelText, roleAccessOf, roleNameOf, roleOf, type MatrixData, type MatrixEmployee } from "./rolesBits";

// YANGI VERSIYA — «ALOHIDA RUXSAT» PANELI (25-qism, rasm «Rollar va huquqlar · Alohida ruxsat»):
//   sarlavha — avatar, ism, «rol · filial · login», ×;
//   «Rol» (o'zgartirish tasdiq bilan, PATCH /api/hr-employees/:id), «Doira», «Qo'shimcha filial»;
//   «Alohida ruxsatlar · N» — roldan farq qiladigan qatorlar (Qo'shildi / Cheklandi), sababi, ×;
//   «Alohida ruxsat qo'shish» — Qo'shish/Cheklash, bo'lim, daraja, sabab;
//   «Tarix» — ruxsat, rol va login voqealari; pastda jurnal izohi va «Yopish».
//
// Bu faqat panel MAZMUNI — joylashuvi (o'ng chekka, fon) ota sahifada. Ota `key={employee.id}` bilan
// chizsin: boshqa xodimga o'tganda forma holati yangidan boshlansin.

interface Props {
  employee: MatrixEmployee;
  data: MatrixData;
  onClose: () => void;
  onChanged: (patch: Partial<MatrixEmployee> & { id: number }) => void;
}

type Mode = "add" | "restrict";
type ApiOk<T> = { ok: true } & T;
type ApiResult<T> = ApiOk<T> | { ok: false; error: string };

async function callJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (!res.ok || !json || json.ok === false) return { ok: false, error: json?.error || `HTTP ${res.status}` };
    return { ...json, ok: true };
  } catch {
    return { ok: false, error: "Tarmoq xatosi — qayta urinib ko'ring" };
  }
}

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** «Moliya · Oylik» — qator nomining o'zi (bo'lim nomi qo'shilmaydi: «Moliya va sotuv · Moliya · Oylik» takrorlanardi). */
function rowTitle(row: AccessRow, t: TFn): string {
  return t(row.label);
}

const LOGIN_TEXT: Record<MatrixEmployee["login"], string> = {
  none: "login yo'q",
  invited: "login yuborilgan",
  expired: "taklif muddati o'tgan",
  active: "login bor",
  blocked: "login bloklangan",
};

const ADD_TONE = { badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" };
const RESTRICT_TONE = { badge: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" };

export default function EmployeeAccessPanelV2({ employee, data, onClose, onChanged }: Props) {
  const { t } = useT();
  const f = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { branchId } = useBranch();
  const closeRef = useRef<HTMLButtonElement>(null);

  const me = data.me;
  const isSelf = me.employeeId !== null && me.employeeId === employee.id;
  const canAdd = me.isAdmin || !isSelf;

  // ── Tarix va sabablar (GET /api/roles/overrides/:id) ─────────────────
  const [hist, setHist] = useState<{ id: number; notes: AccessNote[]; history: HistoryItem[]; error: string } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void callJson<{ notes: AccessNote[]; history: HistoryItem[] }>(`/api/roles/overrides/${employee.id}`).then((r) => {
      if (!alive) return;
      setHist(r.ok ? { id: employee.id, notes: r.notes, history: r.history, error: "" } : { id: employee.id, notes: [], history: [], error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [employee.id, tick]);
  const view = hist !== null && hist.id === employee.id ? hist : null;
  const loaded = view !== null;
  const notes = view?.notes ?? [];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // ── Hisoblangan holat ─────────────────────────────────────────────────
  const roleAccess = roleAccessOf(employee, data.roles);
  const current = employee.admin ? null : (employee.override ?? roleAccess);
  const diffs = useMemo(
    () => (employee.admin || employee.override === null ? [] : accessDiff(roleAccess, employee.override)),
    [employee.admin, employee.override, roleAccess],
  );
  const roleName = roleNameOf(employee, data.roles, t);
  const branchName = (id: number) => data.branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const branchNames = employee.branchIds.map(branchName);

  // ── Rol ───────────────────────────────────────────────────────────────
  // PATCH /api/hr-employees/:id navbardagi filial hovuziga kesiladi (lib/employeeBranches.ts →
  // scopedEmployeeFilter) — boshqa filial xodimining roli shu yerda «Xodim topilmadi» bo'lardi.
  const pool = branchId === null ? null : branchPool(branchId);
  const inPool = pool === null || employee.branchIds.some((id) => pool.includes(id));
  const roleLock: string =
    employee.admin && !me.isAdmin
      ? t("Administratorni faqat admin o'zgartiradi")
      : employee.branchIds.length === 0
        ? t("Xodimga filial biriktirilmagan — avval xodim kartasida filial tanlang")
        : !inPool
          ? t("Rolni o'zgartirish uchun navbarda xodim filialini tanlang")
          : "";
  const roleValue = employee.admin ? "admin" : String(roleOf(employee, data.roles)?.id ?? "");
  const roleOptions = useMemo(() => {
    const list = data.roles.map((r) => ({ value: String(r.id), label: t(r.name) }));
    return me.isAdmin ? [{ value: "admin", label: t("Administrator") }, ...list] : list;
  }, [data.roles, me.isAdmin, t]);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const pendingRoleName = pendingRole === null ? "" : (roleOptions.find((o) => o.value === pendingRole)?.label ?? "");

  const [busy, setBusy] = useState<string | null>(null);

  async function changeRole(next: string) {
    setPendingRole(null);
    setBusy("role");
    // Tarjimasiz nom — server uni hozirgi rol nomi bilan solishtiradi va tarixda shunday saqlaydi.
    const oldName = employee.admin
      ? "Administrator"
      : (roleOf(employee, data.roles)?.name ?? (employee.turi && employee.turi !== "staff" ? employee.turi : "Lavozimsiz"));
    const body = next === "admin" ? { turi: "admin", centerRoleId: null } : { centerRoleId: Number(next) };
    const r = await callJson<{ employee: { turi?: unknown; centerRoleId?: unknown } }>(`/api/hr-employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      setBusy(null);
      showError(t(r.error));
      return;
    }
    const emp = r.employee ?? {};
    const cr = emp.centerRoleId;
    onChanged({
      id: employee.id,
      turi: typeof emp.turi === "string" ? emp.turi : employee.turi,
      centerRoleId: cr === null || cr === undefined ? null : Number(cr),
      admin: next === "admin",
    });
    // Tarix uchun yozuv (rolning o'zi allaqachon o'zgardi — bu yozilmasa ham xato emas).
    await callJson(`/api/roles/overrides/${employee.id}`, postJson({ op: "role", roleFrom: oldName }));
    setBusy(null);
    setTick((n) => n + 1);
    showSuccess(t("Rol o'zgartirildi"));
  }

  // ── Alohida ruxsat amallari ───────────────────────────────────────────
  async function runOp(op: "add" | "restrict" | "revert" | "reset", row: string | null, reason = ""): Promise<boolean> {
    setBusy(op === "revert" ? `revert:${row}` : op);
    const r = await callJson<{ override: string[] | null; notes: AccessNote[] }>(
      `/api/roles/overrides/${employee.id}`,
      postJson({ op, ...(row ? { row } : {}), ...(reason ? { reason } : {}) }),
    );
    setBusy(null);
    if (!r.ok) {
      showError(t(r.error));
      return false;
    }
    onChanged({ id: employee.id, override: r.override });
    setHist((h) => (h && h.id === employee.id ? { ...h, notes: r.notes } : h));
    setTick((n) => n + 1);
    showSuccess(
      op === "add"
        ? t("Bo'lim qo'shildi")
        : op === "restrict"
          ? t("Bo'lim cheklandi")
          : op === "revert"
            ? t("Bo'lim rol bo'yicha qaytarildi")
            : t("Alohida ruxsat olib tashlandi"),
    );
    return true;
  }
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Qo'shish formasi ─────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(canAdd ? "add" : "restrict");
  const [rowKey, setRowKey] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const curSet = useMemo(() => (current === null ? null : new Set(current)), [current]);
  const grantorSet = useMemo(() => (me.access === null ? null : new Set(me.access)), [me.access]);
  const { rowOptions, beyond } = useMemo(() => {
    const opts: { value: string; label: string; hint: string }[] = [];
    let over = 0;
    for (const row of GRANTABLE_ROWS) {
      const st = rowState(row, current);
      if (mode === "add") {
        if (st.level === "full") continue;
        // «O'zida borini beradi» (lib/permissionGrant.ts) — ochiladigan sahifalar so'rov egasida bo'lsin.
        const adding = curSet === null ? [] : row.pages.filter((p) => !curSet.has(p.href));
        if (grantorSet !== null && adding.some((p) => !grantorSet.has(p.href))) {
          over += 1;
          continue;
        }
      } else if (st.level !== "full" && st.level !== "partial") continue;
      opts.push({ value: row.key, label: rowTitle(row, t), hint: levelText(st, t) });
    }
    return { rowOptions: opts, beyond: over };
  }, [mode, current, curSet, grantorSet, t]);
  const rowPicked = rowOptions.some((o) => o.value === rowKey) ? rowKey : "";
  const reasonOk = reason.trim().length > 0;

  async function submit() {
    if (!rowPicked) {
      setFormError(t("Bo'limni tanlang"));
      return;
    }
    if (!reasonOk) {
      setFormError(t("Sababini yozing — u jurnalda qoladi"));
      return;
    }
    setFormError("");
    if (await runOp(mode, rowPicked, reason.trim())) {
      setRowKey("");
      setReason("");
    }
  }

  // ── Doira / filiallar ─────────────────────────────────────────────────
  const extraBranches = employee.branchIds.slice(1).map(branchName);
  const doira = employee.admin ? t("Hamma filial") : employee.branchIds.length === 0 ? t("Filial biriktirilmagan") : t("O'z filiali");

  const canSeeJournal = me.access === null || me.access.includes("/amallar-jurnali");
  const card = "rounded-v2-md border border-v2-border bg-v2-surface";
  const sectionTitle = "text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3";

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label={employee.name}
      className="flex h-full w-full flex-col border-l border-v2-border bg-v2-surface text-v2-body text-v2-text shadow-v2-md"
    >
      {/* Sarlavha */}
      <header className="shrink-0 border-b border-v2-border px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          {employee.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-v2-body font-semibold text-v2-brand-text" aria-hidden>
              {initialsOf(employee.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-v2-section text-v2-text" title={employee.name}>
              {employee.name}
            </h2>
            <p className="mt-1 truncate text-v2-small text-v2-text-2">
              {[roleName, branchNames.length > 0 ? branchNames.join(", ") : t("Filialsiz"), t(LOGIN_TEXT[employee.login])].join(" · ")}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title={t("Yopish")}
            aria-label={t("Yopish")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Rol, doira, filial */}
        <section className="space-y-3">
          <div>
            <FieldLabel htmlFor="access-role">{t("Rol")}</FieldLabel>
            {roleLock ? (
              <>
                <div className={fieldCls("default", "flex items-center gap-2 bg-v2-surface-2! text-v2-text-2")} id="access-role">
                  <span className="min-w-0 flex-1 truncate">{roleName}</span>
                  <Lock className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={2} aria-hidden />
                </div>
                <FieldHint>{roleLock}</FieldHint>
              </>
            ) : (
              <div className="relative">
                <V2Select
                  id="access-role"
                  label={t("Rol")}
                  value={roleValue}
                  options={roleOptions}
                  placeholder={roleName}
                  clearable={false}
                  onChange={(v) => {
                    if (v && v !== roleValue && busy === null) setPendingRole(v);
                  }}
                />
                {busy === "role" && <Loader2 className="absolute right-9 top-3 size-4 animate-spin text-v2-text-3" aria-hidden />}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-v2-small text-v2-text-2">{t("Doira")}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-v2-full bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-semibold text-v2-text-2">{doira}</span>
              {!employee.admin && extraBranches.length > 0 && (
                <span className="rounded-v2-full bg-v2-brand-bg px-2 py-0.5 text-v2-caption font-semibold tabular-nums text-v2-brand">+{extraBranches.length}</span>
              )}
            </span>
          </div>

          {!employee.admin && (
            <div className={`${card} flex items-start gap-3 px-3 py-2.5`}>
              <div className="min-w-0 flex-1">
                <div className="text-v2-small font-semibold text-v2-text">{t("Qo'shimcha filial")}</div>
                <div className="mt-0.5 text-v2-small text-v2-text-2">
                  {extraBranches.length > 0
                    ? extraBranches.join(", ")
                    : branchNames.length > 0
                      ? t("Yo'q — faqat {branch}", { branch: branchNames[0] })
                      : t("Filial biriktirilmagan")}
                </div>
              </div>
              <Link
                href={`/management-xodimlar/${employee.id}`}
                className="shrink-0 rounded-v2-sm px-1 text-v2-small font-semibold text-v2-brand hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus"
              >
                {t("Xodim kartasida")}
              </Link>
            </div>
          )}
        </section>

        {employee.admin ? (
          <div className="flex items-start gap-2.5 rounded-v2-md bg-v2-brand-bg px-3 py-2.5 text-v2-small text-v2-brand">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>{t("Administrator — barcha bo'limlar ochiq, alohida ruxsat kerak emas")}</span>
          </div>
        ) : (
          <>
            {/* Alohida ruxsatlar */}
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className={sectionTitle}>
                  {t("Alohida ruxsatlar")} · <span className="tabular-nums">{diffs.length}</span>
                </h3>
                {employee.override !== null && (
                  <span className="text-v2-caption text-v2-text-3">
                    {t("qolgan {n} bo'lim — rol bo'yicha", { n: GRANTABLE_ROWS.length - diffs.length })}
                  </span>
                )}
              </div>

              {employee.override === null ? (
                <p className="text-v2-small text-v2-text-2">{t("Alohida ruxsat yo'q — hamma bo'lim rol bo'yicha")}</p>
              ) : diffs.length === 0 ? (
                <div className={`${card} flex flex-wrap items-center gap-3 px-3 py-2.5`}>
                  <p className="min-w-0 flex-1 text-v2-small text-v2-text-2">{t("Istisno saqlangan, lekin roldan farqi yo'q")}</p>
                  <button type="button" disabled={busy !== null} onClick={() => setConfirmReset(true)} className={`${secondaryBtn} disabled:opacity-60`}>
                    {t("Istisnoni olib tashlash")}
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {diffs.map((d) => {
                    const add = d.kind === "add";
                    const note = loaded ? latestReasonFor(notes, d.row.key) : null;
                    const at = note?.at ? new Date(note.at) : null;
                    const rowBusy = busy === `revert:${d.row.key}`;
                    return (
                      <li key={d.row.key} className={`${card} flex items-start gap-2.5 p-3`}>
                        <span
                          className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${add ? "bg-v2-success-bg text-v2-success" : "bg-v2-warning-bg text-v2-warning"}`}
                          aria-hidden
                        >
                          {add ? <CirclePlus className="size-3.5" strokeWidth={2} /> : <CircleMinus className="size-3.5" strokeWidth={2} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="min-w-0 truncate text-v2-small font-semibold text-v2-text">{rowTitle(d.row, t)}</span>
                            <ToneBadge tone={add ? ADD_TONE : RESTRICT_TONE}>{add ? t("Qo'shildi") : t("Cheklandi")}</ToneBadge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-v2-caption text-v2-text-2">
                            <span>{t("Rolda")}</span>
                            <LevelChip state={d.from} t={t} compact />
                            <ArrowRight className="size-3 text-v2-text-3" strokeWidth={2} aria-hidden />
                            <LevelChip state={d.to} t={t} compact />
                          </div>
                          {note ? (
                            <>
                              <p className="mt-1.5 break-words text-v2-small text-v2-text">«{note.reason}»</p>
                              <p className="mt-0.5 text-v2-caption tabular-nums text-v2-text-3">
                                {[note.byName, at ? f.stamp(uzDateIso(at), uzTimeHm(at)) : ""].filter(Boolean).join(" · ")}
                              </p>
                            </>
                          ) : loaded ? (
                            <p className="mt-1.5 text-v2-caption text-v2-text-3">{t("Sababi yozilmagan — eski istisno")}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void runOp("revert", d.row.key)}
                          title={t("Rol bo'yicha qaytarish")}
                          aria-label={t("Rol bo'yicha qaytarish")}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus disabled:opacity-50"
                        >
                          {rowBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" strokeWidth={2} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Alohida ruxsat qo'shish */}
            <section className={`${card} space-y-3 p-3`}>
              <h3 className="text-v2-small font-semibold text-v2-text">{t("Alohida ruxsat qo'shish")}</h3>
              <Segmented
                label={t("Amal")}
                value={mode}
                onChange={(v) => {
                  setMode(v as Mode);
                  setFormError("");
                }}
                options={[
                  {
                    value: "add",
                    label: t("Qo'shish"),
                    icon: <CirclePlus className="size-3.5" strokeWidth={2} aria-hidden />,
                    disabled: !canAdd,
                    title: canAdd ? undefined : t("O'zingizga yangi bo'lim ocha olmaysiz — buni admin qilsin"),
                  },
                  { value: "restrict", label: t("Cheklash"), icon: <CircleMinus className="size-3.5" strokeWidth={2} aria-hidden /> },
                ]}
              />
              <div>
                <FieldLabel htmlFor="access-row">{t("Bo'lim")}</FieldLabel>
                <V2Select
                  id="access-row"
                  label={t("Bo'lim")}
                  value={rowPicked}
                  options={rowOptions}
                  placeholder={rowOptions.length > 0 ? t("Bo'limni tanlang") : t("Tanlanadigan bo'lim yo'q")}
                  clearable={false}
                  onChange={(v) => {
                    setRowKey(v);
                    setFormError("");
                  }}
                />
                {mode === "add" && current === null && <FieldHint>{t("Rolda cheklov yo'q — hamma bo'lim allaqachon ochiq")}</FieldHint>}
                {mode === "add" && beyond > 0 && <FieldHint>{t("Sizda yo'q {n} bo'lim ro'yxatda emas — ularni bera olmaysiz", { n: beyond })}</FieldHint>}
              </div>
              {mode === "add" && (
                <div>
                  <FieldLabel>{t("Daraja")}</FieldLabel>
                  <Segmented
                    label={t("Daraja")}
                    value="full"
                    onChange={() => {}}
                    options={[
                      { value: "view", label: t("Ko'rish"), disabled: true, title: t("Faqat ko'rish darajasi hali yo'q") },
                      { value: "full", label: t("To'liq") },
                    ]}
                  />
                </div>
              )}
              <div>
                <FieldLabel htmlFor="access-reason">{t("Sabab")}</FieldLabel>
                <TextInput
                  id="access-reason"
                  value={reason}
                  maxLength={REASON_MAX}
                  placeholder={t("Nima uchun kerak — jurnalda qoladi")}
                  state={formError && !reasonOk ? "error" : "default"}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFormError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                />
                {formError && <FieldError>{formError}</FieldError>}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy !== null || !rowPicked || !reasonOk}
                  onClick={() => void submit()}
                  className={`${primaryBtn} disabled:opacity-60`}
                >
                  {busy === "add" || busy === "restrict" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {mode === "add" ? t("Qo'shish") : t("Cheklash")}
                </button>
              </div>
            </section>
          </>
        )}

        {/* Tarix */}
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className={sectionTitle}>{t("Tarix")}</h3>
            {canSeeJournal && (
              <Link href="/amallar-jurnali" className="text-v2-caption font-semibold text-v2-brand hover:underline focus-visible:outline-none focus-visible:shadow-v2-focus">
                {t("Amallar jurnali")}
              </Link>
            )}
          </div>
          {view === null ? (
            <div className="flex items-center gap-2 py-2 text-v2-small text-v2-text-3">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("Yuklanmoqda…")}
            </div>
          ) : view.error ? (
            <p className="text-v2-small text-v2-danger">{t(view.error)}</p>
          ) : view.history.length === 0 ? (
            <p className="flex items-center gap-2 text-v2-small text-v2-text-3">
              <History className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Hali yozuv yo'q")}
            </p>
          ) : (
            <ol className="space-y-2.5">
              {view.history.map((h, i) => {
                const d = new Date(h.at);
                const when = Number.isNaN(d.getTime()) ? "" : f.stamp(uzDateIso(d), uzTimeHm(d));
                return (
                  <li key={`${h.at}-${i}`} className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-v2-text-3" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-v2-small text-v2-text">{historyText(h, t)}</div>
                      <div className="mt-0.5 text-v2-caption tabular-nums text-v2-text-3">{[when, h.byName].filter(Boolean).join(" · ")}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-v2-border px-5 py-3">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-v2-caption text-v2-text-2">
          <Info className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0">{t("Har o'zgarish Amallar jurnalida: kim, qachon, sababi.")}</span>
        </span>
        <button type="button" onClick={onClose} className={secondaryBtn}>
          {t("Yopish")}
        </button>
      </footer>

      {pendingRole !== null && (
        <V2Confirm
          tone="brand"
          icon={ShieldCheck}
          title={t("Rolni o'zgartirasizmi?")}
          body={
            <>
              <span className="block">{t("{name}: {from} → {to}", { name: employee.name, from: roleName, to: pendingRoleName })}</span>
              <span className="mt-1.5 block">
                {pendingRole === "admin"
                  ? t("Administrator barcha bo'limlarni ko'radi va cheklovdan ozod.")
                  : employee.override !== null && !employee.admin
                    ? t("Xodimda alohida ruxsat bor — u ustun: bo'limlari o'zgarmaydi, farqlar yangi rolga nisbatan ko'rsatiladi.")
                    : t("Bo'limlar yangi rol bo'yicha ochiladi.")}
              </span>
            </>
          }
          confirmLabel={t("O'zgartirish")}
          onConfirm={() => void changeRole(pendingRole)}
          onCancel={() => setPendingRole(null)}
        />
      )}
      {confirmReset && (
        <V2Confirm
          tone="brand"
          title={t("Istisnoni olib tashlaysizmi?")}
          body={t("Xodim bo'limlari to'liq rol bo'yicha bo'ladi.")}
          confirmLabel={t("Olib tashlash")}
          onConfirm={() => {
            setConfirmReset(false);
            void runOp("reset", null);
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </aside>
  );
}

/** Tarix qatori matni. */
function historyText(h: HistoryItem, t: TFn): string {
  switch (h.kind) {
    case "access":
      return h.from && h.to
        ? t("{row}: {from} → {to}", { row: t(h.rowLabel ?? ""), from: levelText(h.from, t), to: levelText(h.to, t) })
        : t(h.rowLabel ?? "");
    case "role":
      return t("Rol: {from} → {to}", { from: t(h.roleFrom ?? ""), to: t(h.roleTo ?? "") });
    case "reset":
      return t("Alohida ruxsat olib tashlandi");
    case "account":
      return t("Login hisobi yaratildi");
    case "invite":
      return t("Login taklifi yuborildi");
    case "activated":
      return t("Login faollashtirildi");
  }
}
