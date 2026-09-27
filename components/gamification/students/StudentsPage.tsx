"use client";

import "../gamification.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { cardCls, Chip, inputCls, useGamToast } from "../ui";
import ProfileModal, { ToifaChip } from "../profile/ProfileModal";

// Gamifikatsiya → O'quvchilar (TZ 5.3; prototipdagi «O'quvchilar»).
// Har o'quvchida bitta hamyon — bir necha kursda o'qisa ham. Qatorni
// bosish (yoki Enter) — profil oynasi. Muzlatilganlar ro'yxat oxirida.
// Filial — navbardagi tanlov (CRM ning hamma sahifasidagidek).

interface Row {
  pupilId: number;
  name: string;
  grade: number | null;
  toifa: "kids" | "older";
  branchName: string;
  groups: string[];
  levelPosition: number;
  levelName: string;
  balance: number;
  frozen: boolean;
}

const PAGE = "gm-page page-frame-lg container mx-auto max-w-[1900px] space-y-4 p-4 md:p-5";

export default function StudentsPage() {
  const { t } = useT();
  const [toastNode, toast] = useGamToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(
    () =>
      gamApi<{ rows: Row[]; role: GamRole }>("/api/gamification/students").then((res) => {
        if (res.ok) {
          setRows(res.rows);
          setError("");
        } else setError(res.error);
      }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !k || r.name.toLowerCase().includes(k));
  }, [rows, q]);

  return (
    <div className={PAGE}>
      {toastNode}
      <div>
        <h1 className="text-xl font-semibold">{t("O'quvchilar")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("Har o'quvchida bitta hamyon: bir necha kursda o'qisa ham tangalar bitta balansda. Qatorni bosing — profil, tarix va guruhlardagi o'rni ochiladi.")}
        </p>
      </div>
      {error && !rows ? (
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t(error)}</div>
      ) : !rows ? (
        <SpinnerBlock />
      ) : (
        <>
          <div className={cardCls}>
            <div className="flex flex-wrap items-center gap-3">
              <input
                aria-label={t("Qidirish")}
                placeholder={t("Ism bo'yicha qidirish")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${inputCls} sm:w-72`}
              />
              <span className="text-[12.5px] text-muted-foreground">{t("{n} ta o'quvchi", { n: list.length })}</span>
            </div>
          </div>
          {list.length === 0 ? (
            <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Hech kim topilmadi.")}</div>
          ) : (
            <div className={`${cardCls} gm-scroll-card table-frame overflow-hidden !p-0`}>
              <div className="table-scroll">
                <table className="gm-table">
                  <thead>
                    <tr>
                      <th>{t("O'quvchi")}</th>
                      <th>{t("Toifa")}</th>
                      <th>{t("Filial")}</th>
                      <th>{t("Guruh(lar)")}</th>
                      <th>{t("Daraja")}</th>
                      <th>{t("Balans")}</th>
                      <th>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr
                        key={r.pupilId}
                        className="gm-click"
                        tabIndex={0}
                        onClick={() => setOpen(r.pupilId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setOpen(r.pupilId);
                        }}
                      >
                        <td data-l="" className="gm-lead">
                          <b>{r.name}</b>
                          {r.grade !== null && <span className="ml-1.5 whitespace-nowrap text-[12px] text-muted-foreground">{t("{n}-sinf", { n: r.grade })}</span>}
                        </td>
                        <td data-l={t("Toifa")}>
                          <ToifaChip toifa={r.toifa} />
                        </td>
                        <td data-l={t("Filial")} className="text-[12.5px]">
                          {r.branchName}
                        </td>
                        <td data-l={t("Guruh(lar)")} className="text-[12.5px]">
                          {r.groups.length ? r.groups.map((g) => <div key={g}>{g}</div>) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td data-l={t("Daraja")}>
                          <Chip tone="b">
                            {r.levelPosition} · {t(r.levelName)}
                          </Chip>
                        </td>
                        <td data-l={t("Balans")}>
                          <span className="gm-coin">{r.balance}</span>
                        </td>
                        <td data-l={t("Holat")}>{r.frozen ? <Chip tone="m">{t("Ketgan — muzlatilgan")}</Chip> : <Chip tone="g">{t("Faol")}</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      {open !== null && <ProfileModal pupilId={open} onClose={() => setOpen(null)} toast={toast} onChanged={() => void load()} />}
    </div>
  );
}
