"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import type { StaffFineSummaryRow, StaffTaskFine, StaffTaskViewerInfo } from "@/lib/staffTasks";
import { api } from "./api";
import { PriorityBadge } from "./bits";
import type { StaffFmt } from "./format";
import { useAnimatedRows, useFlipRows } from "@/hooks/useAnimatedRows";

// «Jarimalar» tabi — jarimalar ro'yxati va Oylikka tushadigan qatorlar
// (xodim × oy). Direktor asosli sabab bilan jarimani bekor qila oladi —
// oyligi chiqarilgan oydan tashqari.

interface FinesData {
  fines: StaffTaskFine[];
  summary: StaffFineSummaryRow[];
  months: string[];
  limitPercent: number;
  canCancel: boolean;
}

interface Props {
  viewer: StaffTaskViewerInfo;
  nowMs: number;
  fmt: StaffFmt;
  /** Oshirilsa ro'yxat qayta yuklanadi (jarima bekor qilingach). */
  reloadKey: number;
  onOpenTask: (taskId: number) => void;
  onCancelFine: (fine: StaffTaskFine) => void;
}

export default function FinesView({ viewer, nowMs, fmt, reloadKey, onOpenTask, onCancelFine }: Props) {
  const { t, stamp, money, monthLabel } = fmt;
  const mgr = viewer.role !== "xodim";
  const [data, setData] = useState<FinesData | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let off = false;
    api<FinesData>("/api/staff-tasks/fines").then((r) => {
      if (off) return;
      if (r.ok) {
        setData(r);
        setError("");
      } else setError(r.error);
    });
    return () => {
      off = true;
    };
  }, [reloadKey]);

  const rows = useMemo(
    () => (data?.fines ?? []).filter((f) => (!month || f.month === month) && (!status || f.status === status)),
    [data, month, status],
  );
  const summary = useMemo(() => (data?.summary ?? []).filter((s) => !month || s.month === month), [data, month]);
  const inForce = rows.filter((f) => f.status === "kuchda");
  const total = inForce.reduce((s, f) => s + f.amount, 0);
  const held = inForce.reduce((s, f) => s + f.held, 0);
  const scope = month ? monthLabel(month) : t("barcha oylar");

  const animated = useAnimatedRows(rows, (f) => f.id, `${month}|${status}`);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const els = useRef(new Map<number, HTMLElement>());
  useFlipRows(animated, bodyRef, els);

  const dir = !!data?.canCancel;
  const cols = 8 + (mgr ? 1 : 0) + (dir ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="stk-tools">
        <Select
          size="sm"
          clearable
          className="stk-filter"
          value={month}
          onChange={setMonth}
          options={(data?.months ?? []).map((m) => ({ value: m, label: monthLabel(m) }))}
          placeholder={t("Oy: barchasi")}
          loading={!data && !error}
        />
        <Select
          size="sm"
          clearable
          className="stk-filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: "kuchda", label: t("Kuchda") },
            { value: "bekor", label: t("Bekor qilingan") },
          ]}
          placeholder={t("Holat: barchasi")}
        />
      </div>

      <div className="stk-kpis is-3">
        <div className="stk-kpi is-static stk-c-gray">
          <span className="stk-kpi-lbl">{t("Jarimalar")}</span>
          <span className="stk-kpi-num">{t("{n} ta", { n: rows.length })}</span>
          <span className="stk-kpi-sub">{scope}</span>
        </div>
        <div className="stk-kpi is-static stk-c-bad">
          <span className="stk-kpi-lbl">{t("Kuchda, jami")}</span>
          <span className="stk-kpi-num">{money(total)}</span>
          <span className="stk-kpi-sub">{t("{n} ta jarima", { n: inForce.length })}</span>
        </div>
        <div className="stk-kpi is-static stk-c-hot">
          <span className="stk-kpi-lbl">{t("Oylikdan ushlanadi")}</span>
          <span className="stk-kpi-num">{money(held)}</span>
          <span className="stk-kpi-sub">{held < total ? t("{sum} limitdan oshdi", { sum: money(total - held) }) : t("limit ichida")}</span>
        </div>
      </div>

      <div className="stk-card">
        <h3>{t("Jarimalar ro'yxati")}</h3>
        <div className="stk-scroll">
          <table className="stk-tbl stk-stack">
            <thead>
              <tr>
                {mgr && <th>{t("Xodim")}</th>}
                <th>{t("Topshiriq")}</th>
                <th>{t("Muhimlik")}</th>
                <th>{t("Deadline")}</th>
                <th>{t("Qayta muddat")}</th>
                <th>{t("Bajarilmadi")}</th>
                <th className="c-r">{t("Summa")}</th>
                <th>{t("Oy")}</th>
                <th>{t("Holat")}</th>
                {dir && <th />}
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {!data && (
                <tr className="stk-empty">
                  <td colSpan={cols}>{error ? t(error) : t("Yuklanmoqda…")}</td>
                </tr>
              )}
              {animated.map((r) => {
                const f = r.item;
                return (
                  <tr
                    key={r.key}
                    ref={(el) => {
                      if (el) els.current.set(r.key, el);
                      else els.current.delete(r.key);
                    }}
                    className={r.phase === "enter" ? "stk-row-enter" : r.phase === "exit" ? "stk-row-exit" : ""}
                    style={r.phase === "enter" ? ({ "--stk-delay": `${Math.min(r.order, 12) * 22}ms` } as CSSProperties) : undefined}
                  >
                    {mgr && (
                      <td data-l={t("Xodim:")}>
                        {f.employeeName}
                      </td>
                    )}
                    <td data-l={t("Topshiriq:")}>
                      <button type="button" className="stk-link" onClick={() => onOpenTask(f.taskId)}>
                        {f.taskTitle}
                      </button>
                    </td>
                    <td data-l={t("Muhimlik:")}>
                      <PriorityBadge p={f.priority} fmt={fmt} />
                    </td>
                    <td data-l={t("Deadline:")}>{stamp(f.deadline, nowMs)}</td>
                    <td data-l={t("Qayta muddat:")}>{stamp(f.redeadline, nowMs)}</td>
                    <td data-l={t("Bajarilmadi:")}>{stamp(f.failedAt, nowMs)}</td>
                    <td className="c-r" data-l={t("Summa:")}>
                      <b>{money(f.amount)}</b>
                    </td>
                    <td data-l={t("Oy:")}>
                      {monthLabel(f.month)}
                      {f.closed && <span className="stk-subline">{t("oylik chiqarilgan")}</span>}
                    </td>
                    <td data-l={t("Holat:")}>
                      {f.status === "kuchda" ? (
                        <>
                          <span className="stk-chip stk-tone-bad">{t("Kuchda")}</span>{" "}
                          {f.held < f.amount && (
                            <span className="stk-chip no-dot stk-tone-amber">{t("limitdan oshdi, ushlanadi {sum}", { sum: money(f.held) })}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="stk-chip stk-tone-gray">{t("Bekor qilingan")}</span>
                          <span className="stk-subline">
                            {f.cancelReason} — {f.cancelledBy}, {stamp(f.cancelledAt, nowMs)}
                          </span>
                        </>
                      )}
                    </td>
                    {dir && (
                      <td className="c-act">
                        {f.status === "kuchda" &&
                          (f.closed ? (
                            <span className="text-[12.5px] text-muted-foreground">{t("oylik chiqarilgan")}</span>
                          ) : (
                            <Button variant="outline" className="stk-btn-sm stk-btn-bad" onClick={() => onCancelFine(f)}>
                              {t("Bekor qilish")}
                            </Button>
                          ))}
                      </td>
                    )}
                  </tr>
                );
              })}
              {data && animated.length === 0 && (
                <tr className="stk-empty stk-row-enter">
                  <td colSpan={cols}>{t("Jarima yo'q.")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stk-card">
        <h3>{t("Oylik moduliga tushadigan qatorlar — xodim va oy bo'yicha")}</h3>
        <div className="stk-scroll">
          <table className="stk-tbl stk-stack">
            <thead>
              <tr>
                <th>{t("Xodim")}</th>
                <th>{t("Oy")}</th>
                <th className="c-r">{t("Oklad")}</th>
                <th className="c-r">{t("Limit ({n}%)", { n: data?.limitPercent ?? 0 })}</th>
                <th className="c-r">{t("Jami jarima")}</th>
                <th className="c-r">{t("Ushlanadi")}</th>
                <th className="c-r">{t("Ushlanmaydi")}</th>
                <th>{t("Oylik")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr className="stk-empty">
                  <td colSpan={8}>{data ? t("Kuchdagi jarima yo'q.") : t("Yuklanmoqda…")}</td>
                </tr>
              ) : (
                summary.map((s) => (
                  <tr key={`${s.employeeId}-${s.month}`} className="stk-row-enter">
                    <td className="stk-title" data-l="">
                      {s.employeeName}
                    </td>
                    <td data-l={t("Oy:")}>{monthLabel(s.month)}</td>
                    <td className="c-r" data-l={t("Oklad:")}>
                      {s.oklad !== null ? money(s.oklad) : <span className="text-muted-foreground">{t("sozlanmagan")}</span>}
                    </td>
                    <td className="c-r" data-l={t("Limit:")}>
                      {s.limit !== null ? money(s.limit) : <span className="text-muted-foreground">{t("limit yo'q")}</span>}
                    </td>
                    <td className="c-r" data-l={t("Jami:")}>
                      {money(s.total)}
                    </td>
                    <td className="c-r" data-l={t("Ushlanadi:")}>
                      <b style={{ color: "var(--stk-bad)" }}>{money(s.held)}</b>
                    </td>
                    <td className="c-r" data-l={t("Ushlanmaydi:")}>
                      {s.held < s.total ? <span className="stk-chip no-dot stk-tone-amber">{money(s.total - s.held)}</span> : "—"}
                    </td>
                    <td data-l={t("Oylik:")}>{t(s.closed ? "chiqarilgan" : "ochiq")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="stk-pad stk-note">
          {t(
            "Ushlanadi — Moliya → Jarima ga yozilgan va Oylik modulida xodimning qolgan oyligidan ayiriladigan summa (limit doirasida, jarimalar vaqt tartibida hisoblanadi). Limitdan oshgan qismi tarixda qoladi, ushlanmaydi. Oklad sozlanmagan xodimda limit qo'llanmaydi.",
          )}
        </div>
      </div>
    </div>
  );
}
