"use client";

import { useEffect, useState } from "react";
import type { StaffTaskBranch, StaffTaskStatRow, StaffTaskViewerInfo } from "@/lib/staffTasks";
import { api } from "./api";
import type { StaffFmt } from "./format";

// «Statistika» tabi — xodim kesimida: jami, faol, o'z vaqtida, kechikib,
// bajarilmadi, o'z vaqtida % va kuchdagi jarimalar.

interface Props {
  viewer: StaffTaskViewerInfo;
  branches: StaffTaskBranch[];
  fmt: StaffFmt;
  reloadKey: number;
}

export default function StatsView({ viewer, branches, fmt, reloadKey }: Props) {
  const { t, money } = fmt;
  const [rows, setRows] = useState<StaffTaskStatRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    api<{ rows: StaffTaskStatRow[] }>("/api/staff-tasks/stats").then((r) => {
      if (off) return;
      if (r.ok) {
        setRows(r.rows);
        setError("");
      } else setError(r.error);
    });
    return () => {
      off = true;
    };
  }, [reloadKey]);

  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? "";
  const barColor = (pct: number) => (pct >= 80 ? "var(--stk-ok)" : pct >= 50 ? "var(--stk-amber)" : "var(--stk-bad)");

  return (
    <div className="stk-card">
      <h3>{t(viewer.role === "xodim" ? "Mening statistikam" : "Xodimlar bo'yicha statistika")}</h3>
      <div className="stk-scroll table-box">
        <table className="stk-tbl stk-stack">
          <thead>
            <tr>
              <th>{t("Xodim")}</th>
              <th className="c-r">{t("Jami")}</th>
              <th className="c-r">{t("Faol")}</th>
              <th className="c-r">{t("O'z vaqtida")}</th>
              <th className="c-r">{t("Kechikib")}</th>
              <th className="c-r">{t("Bajarilmadi")}</th>
              <th>{t("O'z vaqtida %")}</th>
              <th className="c-r">{t("Jarima (kuchda)")}</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr className="stk-empty">
                <td colSpan={8}>{error ? t(error) : t("Yuklanmoqda…")}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="stk-empty">
                <td colSpan={8}>{t("Hali ma'lumot yo'q.")}</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.employeeId} className="stk-row-enter" style={{ ["--stk-delay" as string]: `${Math.min(i, 12) * 22}ms` }}>
                  <td className="stk-title" data-l="">
                    {r.employeeName}
                    {r.branchId > 0 && <span className="stk-subline">{branchName(r.branchId)}</span>}
                  </td>
                  <td className="c-r" data-l={t("Jami:")}>{r.total}</td>
                  <td className="c-r" data-l={t("Faol:")}>{r.active}</td>
                  <td className="c-r" data-l={t("O'z vaqtida:")}>{r.onTime}</td>
                  <td className="c-r" data-l={t("Kechikib:")}>{r.late}</td>
                  <td className="c-r" data-l={t("Bajarilmadi:")}>{r.failed}</td>
                  <td data-l={t("O'z vaqtida %:")}>
                    {r.pct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="stk-pbar">
                        <i>
                          <b style={{ width: `${r.pct}%`, background: barColor(r.pct) }} />
                        </i>
                        <strong>{r.pct}%</strong>
                      </div>
                    )}
                  </td>
                  <td className="c-r" data-l={t("Jarima:")}>{r.fineTotal ? money(r.fineTotal) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="stk-pad stk-note">
        {t("O'z vaqtida % = o'z vaqtida yakunlangan ÷ (yakunlangan + bajarilmagan). Bekor qilingan topshiriqlar hisobga olinmaydi.")}
      </div>
    </div>
  );
}
