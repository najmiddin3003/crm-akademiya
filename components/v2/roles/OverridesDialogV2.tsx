"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, UserRoundCog } from "lucide-react";
import { useT } from "@/components/shared/Language";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { TextInput } from "@/components/v2/form/fields";
import { EmptyBlock } from "@/components/v2/students/profile/profileBits";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { accessDiff } from "@/lib/accessRows";
import type { Role } from "@/lib/roles";
import { employeesOfRole, roleAccessOf, roleNameOf, type MatrixData, type MatrixEmployee } from "./rolesBits";

// YANGI VERSIYA — «ALOHIDA RUXSATLAR» OYNASI (25-qism): kimda roldan farqli ruxsat bor — ism, rol va
// «+2 / −1» (qancha bo'lim qo'shilgan / cheklangan). Qidiruv BARCHA faol xodimlar bo'yicha (admin —
// cheklovdan ozod, ro'yxatda yo'q): yangi xodimga ruxsat berish ham shu yerdan. Bosilgan xodim —
// «Alohida ruxsat» paneli (ota sahifa ochadi).
// `role` berilsa — o'sha rol xodimlari (jadval ustunidagi ⋯ → «Xodimlari»), qidiruv ham shu ichida.

interface Props {
  data: MatrixData;
  onPick: (employeeId: number) => void;
  onClose: () => void;
  /** Faqat shu rol xodimlari (ustun menyusidagi «Xodimlari»). */
  role?: Role | null;
}

const LIMIT = 60;

function norm(s: string): string {
  return s.toLocaleLowerCase("uz").replace(/[ʻʼ'`‘’]/g, "'").replace(/\s+/g, " ").trim();
}

export default function OverridesDialogV2({ data, onPick, onClose, role = null }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      (role ? employeesOfRole(role, data.employees) : data.employees.filter((e) => !e.admin))
        .map((e) => {
          const diffs = e.override === null ? [] : accessDiff(roleAccessOf(e, data.roles), e.override);
          return {
            emp: e,
            add: diffs.filter((d) => d.kind === "add").length,
            restrict: diffs.filter((d) => d.kind === "restrict").length,
          };
        }),
    [data.employees, data.roles, role],
  );
  const withOverride = useMemo(() => rows.filter((r) => r.emp.override !== null), [rows]);

  const q = norm(query);
  const shown = useMemo(() => {
    if (!q) return role ? rows : withOverride;
    return rows.filter((r) => norm(r.emp.name).includes(q) || norm(roleNameOf(r.emp, data.roles, t)).includes(q));
  }, [q, rows, withOverride, data.roles, t, role]);
  const visible = shown.slice(0, LIMIT);

  const branchName = (e: MatrixEmployee) => {
    const id = e.branchIds[0];
    return id === undefined ? "" : (data.branches.find((b) => b.id === id)?.name ?? "");
  };

  return (
    <V2Dialog
      title={role ? t("{role} — xodimlar", { role: t(role.name) }) : t("Alohida ruxsatlar")}
      subtitle={
        role
          ? t("{n} xodim · {m} tasida alohida ruxsat", { n: rows.length, m: withOverride.length })
          : t("{n} xodimda roldan farqli ruxsat bor", { n: withOverride.length })
      }
      onClose={onClose}
      width={520}
      footerStart={<span className="hidden text-v2-caption text-v2-text-3 sm:inline">{t("Xodimni bosing — ruxsat paneli ochiladi")}</span>}
      footer={(api) => (
        <button type="button" onClick={api.requestClose} className={secondaryBtn}>
          {t("Yopish")}
        </button>
      )}
    >
      {(api) => (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <TextInput
              data-autofocus
              data-enter-ignore
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={role ? t("Xodim qidirish") : t("Xodim qidirish — ruxsat berish uchun")}
              aria-label={t("Xodim qidirish")}
              className="pl-9"
            />
          </div>

          {!q && !role && (
            <div className="text-v2-caption font-semibold uppercase tracking-wide text-v2-text-3">
              {t("Alohida ruxsati borlar")} · <span className="tabular-nums">{withOverride.length}</span>
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyBlock
              icon={<UserRoundCog className="size-5" strokeWidth={1.75} />}
              title={q ? t("Xodim topilmadi") : role ? t("Bu rolda xodim yo'q") : t("Hali alohida ruxsat yo'q")}
              text={
                q
                  ? t("Boshqa ism bilan qidiring")
                  : role
                    ? t("Rol xodim kartasida (lavozim) yoki ruxsat panelida beriladi")
                    : t("Xodimni qidiring va unga ruxsat qo'shing yoki cheklang")
              }
            />
          ) : (
            <ul className="divide-y divide-v2-border overflow-hidden rounded-v2-md border border-v2-border">
              {visible.map(({ emp, add, restrict }) => {
                const branch = branchName(emp);
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(emp.id);
                        api.close();
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-v2-surface-2 focus-visible:bg-v2-surface-2 focus-visible:outline-none"
                    >
                      {emp.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.photoUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-v2-brand-bg text-v2-caption font-semibold text-v2-brand-text" aria-hidden>
                          {initialsOf(emp.name)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-v2-small font-semibold text-v2-text">{emp.name}</span>
                        <span className="block truncate text-v2-caption text-v2-text-2">
                          {[roleNameOf(emp, data.roles, t), branch].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {emp.override !== null && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-v2-caption font-semibold tabular-nums">
                          {add > 0 && <span className="rounded-v2-full bg-v2-success-bg px-1.5 py-0.5 text-v2-success">+{add}</span>}
                          {restrict > 0 && <span className="rounded-v2-full bg-v2-warning-bg px-1.5 py-0.5 text-v2-warning">−{restrict}</span>}
                          {add === 0 && restrict === 0 && <span className="font-normal text-v2-text-3">{t("farq yo'q")}</span>}
                        </span>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {shown.length > LIMIT && (
            <p className="text-center text-v2-caption text-v2-text-3">{t("Yana {n} ta — qidiruvni aniqlashtiring", { n: shown.length - LIMIT })}</p>
          )}
        </div>
      )}
    </V2Dialog>
  );
}
