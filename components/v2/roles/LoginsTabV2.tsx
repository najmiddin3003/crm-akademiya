"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Clock, Info, KeyRound, Lock, RefreshCw, RotateCw, Send, UserCheck, UserX } from "lucide-react";
import { useT, type TFn } from "@/components/shared/Language";
import V2Select from "@/components/v2/ui/V2Select";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Pagination from "@/components/v2/ui/V2Pagination";
import { ROW_TINT } from "@/components/v2/ui/table";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { EmptyBlock, phoneParts, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import type { Role } from "@/lib/roles";
import type { LoginState } from "@/lib/staffAccounts";
import { roleNameOf, type MatrixBranch, type MatrixEmployee } from "./rolesBits";
import {
  canSendLogin,
  inBranch,
  inviteDay,
  loginCounts,
  matchesLoginFilter,
  roleFilterKey,
  type LoginFilter,
  type LoginRow,
} from "./loginsBits";
import LoginGrantDialogV2 from "./LoginGrantDialogV2";

// YANGI VERSIYA — «ROLLAR VA HUQUQLAR» → «LOGIN HISOBLARI» tabi (25-qism, rasmlar «Login
// hisoblari», yorug'/qorong'i, 13.11.2026):
//   • uch karta — Login yo'q (tizimga kira olmaydi) · Yuborilgan, kirmagan (havola 3 kun) ·
//     Login bor (jami N xodimdan);
//   • chip filtrlari (holat) + «Rol» + «Filial: barchasi»;
//   • belgilanganlar qatori: «N ta tanlandi», «Hammasini tanlash (M)», «Bekor qilish»,
//     «Login berish (N)»;
//   • jadval — Xodim (bosh harflar, ism, kurs), Rol, Filial, Login (telefon), Holat, amal.
// Ma'lumot: GET /api/roles/logins (faqat admin). Yuborish: LoginGrantDialogV2 →
// POST /api/temp-staff/invite. Tab sahifada DOIM o'rnatilgan (yashirin bo'lsa ham) — yorliqdagi
// «44» soni `onCounts` orqali shu yerdan.

interface LoginsData {
  employees: LoginRow[];
  smsPreview: string;
  maxBatch: number;
}

const STATE_TONE: Record<LoginState, { label: string; cls: string; icon: typeof UserX }> = {
  none: { label: "Login yo'q", cls: "bg-v2-warning-bg text-v2-warning", icon: UserX },
  invited: { label: "Yuborilgan", cls: "bg-v2-info-bg text-v2-info", icon: Send },
  expired: { label: "Havola eskirgan", cls: "bg-v2-danger-bg text-v2-danger", icon: Clock },
  active: { label: "Login bor", cls: "bg-v2-success-bg text-v2-success", icon: UserCheck },
  blocked: { label: "Bloklangan", cls: "bg-v2-surface-2 text-v2-text-2", icon: Ban },
};

const th =
  "sticky top-0 z-10 whitespace-nowrap bg-v2-surface-2 px-3 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

/** Rol nomi — jadval va panel bilan bir xil (rolesBits → roleNameOf). */
function roleName(row: LoginRow, roles: Role[], t: TFn): string {
  const emp: MatrixEmployee = { ...row, override: null, photoUrl: "" };
  return roleNameOf(emp, roles, t);
}

export default function LoginsTabV2({
  roles,
  branches,
  onCounts,
}: {
  roles: Role[];
  branches: MatrixBranch[];
  onCounts?: (c: { none: number; invited: number; active: number }) => void;
}) {
  const { t } = useT();
  const f = useProfileFmt();
  const [data, setData] = useState<LoginsData | null>(null);
  const [error, setError] = useState<{ text: string; locked: boolean } | null>(null);
  const [version, setVersion] = useState(0);

  // `null` — hali tanlanmagan: kirmaganlar bo'lsa ular (rasmdagidek), bo'lmasa hammasi.
  const [filter, setFilter] = useState<LoginFilter | null>(null);
  const [fRole, setFRole] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [dialogRows, setDialogRows] = useState<LoginRow[] | null>(null);

  const countsRef = useRef(onCounts);
  useEffect(() => {
    countsRef.current = onCounts;
  }, [onCounts]);

  useEffect(() => {
    let alive = true;
    fetch("/api/roles/logins")
      .then(async (r) => ({ status: r.status, d: await r.json().catch(() => ({})) }))
      .then(({ status, d }) => {
        if (!alive) return;
        if (d.ok) {
          const next: LoginsData = { employees: d.employees as LoginRow[], smsPreview: String(d.smsPreview ?? ""), maxBatch: Number(d.maxBatch) || 25 };
          setData(next);
          setError(null);
          const c = loginCounts(next.employees);
          countsRef.current?.({ none: c.none, invited: c.sent, active: c.active });
        } else setError({ text: String(d.error || "Ro'yxat yuklanmadi"), locked: status === 403 });
      })
      .catch(() => alive && setError({ text: "Serverga ulanib bo'lmadi", locked: false }));
    return () => {
      alive = false;
    };
  }, [version]);

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const branchesOf = (row: LoginRow) => row.branchIds.map((id) => branchName.get(id) ?? `#${id}`).join(", ");
  const describe = (row: LoginRow) => [roleName(row, roles, t), branchesOf(row)].filter(Boolean).join(" · ");

  const all = useMemo(() => data?.employees ?? [], [data]);
  const totals = useMemo(() => loginCounts(all), [all]);
  // Rol va filial filtrlari — chip sonlari shulardan keyin.
  const base = useMemo(
    () => all.filter((r) => (!fRole || roleFilterKey(r, roles) === fRole) && inBranch(r, fBranch)),
    [all, fRole, fBranch, roles],
  );
  const baseCounts = useMemo(() => loginCounts(base), [base]);
  const activeFilter: LoginFilter = filter ?? (totals.none > 0 ? "none" : "");
  const shown = useMemo(() => base.filter((r) => matchesLoginFilter(r, activeFilter)), [base, activeFilter]);
  const sendableShown = useMemo(() => shown.filter(canSendLogin), [shown]);
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = shown.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageSendable = pageRows.filter(canSendLogin);
  const pageChecked = pageSendable.filter((r) => selected.has(r.id)).length;

  const roleOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of all) {
      const k = roleFilterKey(r, roles);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const opts: { value: string; label: string; hint: string }[] = [];
    if (counts.get("admin")) opts.push({ value: "admin", label: t("Administrator"), hint: String(counts.get("admin")) });
    for (const role of roles) {
      const n = counts.get(`r:${role.id}`);
      if (n) opts.push({ value: `r:${role.id}`, label: role.name, hint: String(n) });
    }
    if (counts.get("none")) opts.push({ value: "none", label: t("Lavozimsiz"), hint: String(counts.get("none")) });
    return opts;
  }, [all, roles, t]);
  const branchOptions = useMemo(() => branches.map((b) => ({ value: String(b.id), label: b.name })), [branches]);

  function toggle(id: number, on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function setMany(ids: number[], on: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const selectedRows = useMemo(() => all.filter((r) => selected.has(r.id) && canSendLogin(r)), [all, selected]);

  const stateChips: { key: LoginFilter; label: string; n: number }[] = [
    { key: "none", label: t("Login yo'q"), n: baseCounts.none },
    { key: "sent", label: t("Yuborilgan"), n: baseCounts.sent },
    { key: "active", label: t("Login bor"), n: baseCounts.active },
  ];

  if (error) {
    return (
      <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-sm">
        <EmptyBlock
          icon={error.locked ? <Lock className="size-5" strokeWidth={1.75} aria-hidden /> : <Info className="size-5" strokeWidth={1.75} aria-hidden />}
          title={t(error.text)}
          text={error.locked ? t("Login berish va telefonlar ro'yxati faqat administratorga ochiq.") : undefined}
          action={
            error.locked ? undefined : (
              <button type="button" onClick={() => { setError(null); setVersion((v) => v + 1); }} className={secondaryBtn}>
                <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
                {t("Qayta urinish")}
              </button>
            )
          }
        />
      </div>
    );
  }

  const cards = [
    { key: "none", title: t("Login yo'q"), n: totals.none, cls: "text-v2-warning", sub: t("tizimga kira olmaydi") },
    {
      key: "sent",
      title: t("Yuborilgan, kirmagan"),
      n: totals.sent,
      cls: "text-v2-text",
      sub: totals.expired > 0 ? t("{n} tasining muddati o'tgan", { n: totals.expired }) : t("havola 3 kun amal qiladi"),
    },
    { key: "active", title: t("Login bor"), n: totals.active, cls: "text-v2-text", sub: t("jami {n} xodimdan", { n: totals.total }) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* 1. Kartalar */}
      <div className="grid grid-cols-1 divide-y divide-v2-border overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm min-[40rem]:grid-cols-3 min-[40rem]:divide-x min-[40rem]:divide-y-0">
        {cards.map((c) => (
          <div key={c.key} className="min-w-0 px-4 py-3">
            <div className="text-v2-small text-v2-text-2">{c.title}</div>
            <div className={`text-[22px] font-semibold leading-7 tabular-nums ${c.cls}`}>{data ? c.n : "—"}</div>
            <div className="truncate text-v2-caption text-v2-text-3">{data ? c.sub : " "}</div>
          </div>
        ))}
      </div>

      {/* 2. Filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Login holati bo'yicha filtr")}>
          {stateChips.map((c) => {
            const on = activeFilter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(on ? "" : c.key);
                  setPage(1);
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                  on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                }`}
              >
                {on && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
                {c.label}
                <span className="tabular-nums text-v2-text-2">· {data ? c.n : "—"}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <V2Select variant="chip" label={t("Rol")} value={fRole} onChange={(v) => { setFRole(v); setPage(1); }} options={roleOptions} searchable={false} />
          <V2Select
            variant="value"
            label={t("Filial")}
            emptyLabel={t("barchasi")}
            value={fBranch}
            onChange={(v) => { setFBranch(v); setPage(1); }}
            options={branchOptions}
            searchable={false}
          />
        </div>
      </div>

      {/* 3. Belgilanganlar */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-v2-lg border border-v2-brand bg-v2-brand-bg px-4 py-2.5">
          <V2Checkbox checked onChange={() => setSelected(new Set())} label={t("Tanlovni bekor qilish")} />
          <span className="text-v2-body font-semibold text-v2-text">{t("{n} ta tanlandi", { n: selectedRows.length })}</span>
          {sendableShown.length > selectedRows.length && (
            <button
              type="button"
              onClick={() => setMany(sendableShown.map((r) => r.id), true)}
              className="text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline"
            >
              {t("Hammasini tanlash ({n})", { n: sendableShown.length })}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className={secondaryBtn}>
              {t("Bekor qilish")}
            </button>
            <button type="button" onClick={() => setDialogRows(selectedRows)} className={primaryBtn}>
              <KeyRound className="size-4" strokeWidth={2} aria-hidden />
              {t("Login berish ({n})", { n: selectedRows.length })}
            </button>
          </div>
        </div>
      )}

      {/* 4. Jadval */}
      <div className="flex min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="max-h-[70vh] min-h-0 overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} w-10 pl-4 pr-1`}>
                  <V2Checkbox
                    checked={pageSendable.length > 0 && pageChecked === pageSendable.length}
                    indeterminate={pageChecked > 0 && pageChecked < pageSendable.length}
                    disabled={pageSendable.length === 0}
                    onChange={(on) => setMany(pageSendable.map((r) => r.id), on)}
                    label={t("Sahifadagilarni tanlash")}
                  />
                </th>
                <th className={th}>{t("Xodim")}</th>
                <th className={th}>{t("Rol")}</th>
                <th className={th}>{t("Filial")}</th>
                <th className={th}>{t("Login (telefon)")}</th>
                <th className={th}>{t("Holat")}</th>
                <th className={`${th} pr-4`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-[52px] border-b border-v2-border" aria-hidden>
                    <td className="pl-4 pr-1" />
                    <td className="px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-v2-skeleton" />
                        <div className="h-3 w-36 rounded bg-v2-skeleton" />
                      </div>
                    </td>
                    {Array.from({ length: 4 }, (_, j) => (
                      <td key={j} className="px-3">
                        <div className="h-3 w-20 rounded bg-v2-skeleton" />
                      </td>
                    ))}
                    <td />
                  </tr>
                ))}
              {data &&
                pageRows.map((r) => {
                  const sendable = canSendLogin(r);
                  const on = selected.has(r.id);
                  const tone = STATE_TONE[r.login];
                  const Icon = tone.icon;
                  const phone = phoneParts(r.phone)?.copy ?? "";
                  const until = r.login === "invited" ? inviteDay(r.inviteExpiresAt) : "";
                  return (
                    <tr key={r.id} className={`h-[52px] border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                      <td className="py-2.5 pl-4 pr-1">
                        {sendable && <V2Checkbox checked={on} onChange={(v) => toggle(r.id, v)} label={t("{name} — tanlash", { name: r.name })} />}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                            {initialsOf(r.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-v2-text">{r.name}</span>
                            {r.kurs && <span className="block truncate text-v2-caption text-v2-text-2">{t(r.kurs)}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-v2-small text-v2-text-2">{roleName(r, roles, t)}</td>
                      <td className="px-3 py-2.5 text-v2-small text-v2-text-2">{branchesOf(r) || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-v2-small font-medium tabular-nums text-v2-text">{phone || <span className="text-v2-text-3">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption font-semibold ${tone.cls}`}>
                          <Icon className="size-3" strokeWidth={2} aria-hidden />
                          {t(tone.label)}
                        </span>
                        {until && <span className="mt-0.5 block text-[10.5px] text-v2-text-3">{t("{date} gacha", { date: f.dayMonth(until) })}</span>}
                      </td>
                      <td className="py-2.5 pl-1 pr-4 text-right">
                        {sendable && (
                          <button
                            type="button"
                            onClick={() => setDialogRows([r])}
                            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-v2-md border border-v2-border-strong bg-v2-surface px-2.5 text-v2-small font-medium text-v2-text transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
                          >
                            {r.login === "none" ? <KeyRound className="size-3.5" strokeWidth={2} aria-hidden /> : <RotateCw className="size-3.5" strokeWidth={2} aria-hidden />}
                            {r.login === "none" ? t("Login berish") : t("Qayta yuborish")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {data && shown.length === 0 && (
            <div className="p-6">
              <EmptyBlock
                icon={<UserCheck className="size-5" strokeWidth={1.75} aria-hidden />}
                title={activeFilter === "none" ? t("Hammaning logini bor") : t("Bu filtr bo'yicha xodim yo'q")}
                text={fRole || fBranch ? t("Rol yoki filial filtrini o'zgartirib ko'ring.") : undefined}
              />
            </div>
          )}
        </div>
        {data && shown.length > 0 && (
          <V2Pagination
            totalItems={shown.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* 5. Izoh */}
      <div className="space-y-1 text-v2-caption text-v2-text-3">
        <p className="flex items-start gap-1.5">
          <KeyRound className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Login — xodimning telefon raqami. SMS'da faollashtirish havolasi va kod boradi (3 kun amal qiladi); xodim parolni o'zi o'rnatadi.")}
        </p>
        <p className="flex items-start gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {t("Ro'yxatda barcha filiallarning faol xodimlari; arxivdagilar ko'rinmaydi.")}
        </p>
      </div>

      {dialogRows && data && (
        <LoginGrantDialogV2
          rows={dialogRows}
          smsPreview={data.smsPreview}
          maxBatch={data.maxBatch}
          describe={describe}
          onClose={() => setDialogRows(null)}
          onSent={(ids) => {
            setMany(ids, false);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
