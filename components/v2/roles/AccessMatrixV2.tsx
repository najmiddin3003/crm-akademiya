"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, ChevronRight, Eye, Loader2, Lock, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { useT } from "@/components/shared/Language";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import type { Role } from "@/lib/roles";
import { ACCESS_SECTIONS, rowState, setPage, setRowLevel, type Access, type AccessRow } from "@/lib/accessRows";
import { LevelChip, employeesOfRole, levelText, type MatrixData } from "./rolesBits";

// YANGI VERSIYA — «ROLLAR VA HUQUQLAR» JADVALI (25-qism, rasm «Rollar va huquqlar · Yorug'/Qorong'i»).
//
// Ustunlar: Administrator (users.role — cheklovdan ozod, o'zgarmaydi; rasmdagi «Rahbar 🔒») va
// Rollar'dagi har rol (o'rnatilgan O'qituvchi/Moderator + qo'lda qo'shilganlar). Sarlavhada «N xodim»
// va doira: administrator — hamma filial, qolganlar — xodimga biriktirilgan filiallar.
// Qatorlar lib/accessRows.ts dan (bo'limlar bo'yicha). Katak bosilsa — «To'liq / Ko'rish / Yo'q»
// menyusi; «Ko'rish» (faqat ko'radi) tizimda hali yo'q — o'chiq. Bir nechta sahifali qator «›» bilan
// ochiladi va sahifalar alohida yoqiladi (qator «Qisman 2/5» bo'lib qoladi).
// Saqlash darhol — PATCH /api/roles/:id (RolesPageV2 → onSave); «o'zida borini beradi» qoidasi serverda.

/** Menyuda belgisiz band — ✓ li bandlar bilan bir chiziqda tursin. */
function Blank({ className }: { className?: string }) {
  return <span className={className} aria-hidden />;
}

/** Rolning saqlangan ro'yxati: massiv yoki `null` (cheklovsiz). */
function accessOfRole(role: Role): Access {
  return Array.isArray(role.permissions) ? role.permissions : null;
}

export default function AccessMatrixV2({
  data,
  savingKey,
  onSave,
  onRename,
  onDelete,
  onShowEmployees,
}: {
  data: MatrixData;
  /** Saqlanayotgan katak: `${roleId}:${rowKey}` yoki `${roleId}:${href}`. */
  savingKey: string | null;
  onSave: (role: Role, next: string[], key: string, summary: string) => void;
  onRename: (role: Role) => void;
  onDelete: (role: Role) => void;
  /** Ustundagi «N xodim» bosilsa — shu roldagi xodimlar (alohida ruxsat oynasi). */
  onShowEmployees?: (role: Role) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const { me, roles, employees } = data;
  const adminCount = useMemo(() => employees.filter((e) => e.admin).length, [employees]);
  const counts = useMemo(() => new Map(roles.map((r) => [r.id, employeesOfRole(r, employees).length])), [roles, employees]);
  const colCount = roles.length + 2;

  /** Admin bo'lmagan beruvchi o'zida yo'q sahifani bera olmaydi (lib/permissionGrant.ts). */
  const lacks = (pages: { href: string }[]) => me.access !== null && pages.some((p) => !me.access!.includes(p.href));

  const toggleOpen = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  function cellMenu(role: Role, row: AccessRow): ActionMenuEntry[] {
    const access = accessOfRole(role);
    const st = rowState(row, access);
    const cur = st.level;
    const save = (on: boolean) =>
      onSave(role, setRowLevel(access, row, on), `${role.id}:${row.key}`, `${t(role.name)} · ${t(row.label)} → ${on ? t("To'liq") : row.kind === "self" ? t("Ko'rish (o'zi)") : t("Yo'q")}`);
    const fullBlocked = cur !== "full" && lacks(row.pages);
    if (row.kind === "self") {
      return [
        { key: "full", label: t("To'liq"), hint: t("berish va nazorat"), icon: cur === "full" ? Check : Blank, disabled: fullBlocked, title: fullBlocked ? t("O'zingizda yo'q bo'limni bera olmaysiz") : undefined, onSelect: () => cur !== "full" && save(true) },
        { key: "own", label: t("Ko'rish"), hint: t("faqat o'z topshiriqlari"), icon: cur === "own" ? Check : Blank, onSelect: () => cur !== "own" && save(false) },
      ];
    }
    const out: ActionMenuEntry[] = [];
    if (cur === "partial") out.push({ key: "h", heading: t("Hozir: {on}/{total} sahifa ochiq", { on: st.on, total: st.total }) });
    out.push(
      { key: "full", label: t("To'liq"), hint: t("ko'radi, o'zgartiradi"), icon: cur === "full" ? Check : Blank, disabled: fullBlocked, title: fullBlocked ? t("O'zingizda yo'q bo'limni bera olmaysiz") : undefined, onSelect: () => cur !== "full" && save(true) },
      { key: "view", label: t("Ko'rish"), hint: t("hali yo'q"), icon: Blank, disabled: true, title: t("«Faqat ko'radi» darajasi tizimda hali yo'q — sahifa ochiq yoki yopiq") },
      { key: "none", label: t("Yo'q"), hint: t("menyuda yo'q"), icon: cur === "none" ? Check : Blank, onSelect: () => cur !== "none" && save(false) },
    );
    if (row.pages.length > 1) {
      out.push({ key: "d", divider: true }, { key: "pages", label: open.has(row.key) ? t("Sahifalarni yashirish") : t("Sahifalar bo'yicha"), icon: ChevronRight, onSelect: () => toggleOpen(row.key) });
    }
    return out;
  }

  const th = "sticky top-0 z-10 bg-v2-surface-2 px-2 py-2.5 align-bottom text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
  const firstCol = "sticky left-0 z-[1] bg-v2-surface shadow-[inset_-1px_0_0_var(--v2-border)]";
  const cellBox = "w-[7.25rem] min-w-[7.25rem] px-1.5 py-2 text-center align-middle";

  function scopeChip(label: string) {
    return <span className="mt-1 inline-flex whitespace-nowrap rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-px text-[10.5px] font-medium text-v2-text-2">{label}</span>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm lg:flex-1">
      <div className="max-h-[75vh] min-h-0 overflow-auto lg:max-h-none lg:flex-1">
        <table
          // Birinchi ustun telefonda torroq (10.5rem) — aks holda 390px ekranda faqat bitta rol ko'rinardi.
          className="w-full border-separate border-spacing-0 text-v2-body [--first:10.5rem] sm:[--first:16rem]"
          style={{ minWidth: `calc(var(--first) + ${7.25 * (colCount - 1)}rem)` }}
        >
          <thead>
            <tr>
              <th className={`${th} left-0 z-20 w-(--first) min-w-(--first) pl-3 text-left sm:pl-4`}>{t("Bo'lim")}</th>
              <th className={`${th} ${cellBox} text-center`} scope="col">
                <div className="flex flex-col items-center">
                  <span className="inline-flex items-center gap-1 font-semibold text-v2-text">
                    {t("Administrator")}
                    <Lock className="size-3 text-v2-text-3" strokeWidth={2} aria-label={t("O'zgarmaydi")} />
                  </span>
                  <span className="text-v2-caption tabular-nums text-v2-text-3">{t("{n} xodim", { n: adminCount })}</span>
                  {scopeChip(t("Hamma filial"))}
                </div>
              </th>
              {roles.map((r) => {
                const n = counts.get(r.id) ?? 0;
                const menu: ActionMenuEntry[] = [];
                if (onShowEmployees) menu.push({ key: "emp", label: t("Xodimlari ({n})", { n }), icon: Users, onSelect: () => onShowEmployees(r) });
                if (!r.key) {
                  menu.push({ key: "ren", label: t("Nomini o'zgartirish"), icon: Pencil, onSelect: () => onRename(r) });
                  menu.push({ key: "d", divider: true }, { key: "del", label: t("Rolni o'chirish"), icon: Trash2, danger: true, onSelect: () => onDelete(r) });
                }
                return (
                  <th key={r.id} className={`${th} ${cellBox} text-center`} scope="col">
                    <div className="flex flex-col items-center">
                      <span className="flex max-w-full items-start justify-center gap-0.5">
                        <span className="line-clamp-2 break-words font-semibold leading-tight text-v2-text" title={r.description || undefined}>
                          {t(r.name)}
                        </span>
                        {menu.length > 0 && (
                          <ActionMenu items={menu} label={t("{name} — amallar", { name: t(r.name) })} width={220}>
                            {(trigger, isOpen) => (
                              <button
                                type="button"
                                {...trigger}
                                title={t("Amallar")}
                                aria-label={t("{name} — amallar", { name: t(r.name) })}
                                className={`-mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${isOpen ? "bg-v2-surface text-v2-text" : ""}`}
                              >
                                <MoreHorizontal className="size-3.5" strokeWidth={2} />
                              </button>
                            )}
                          </ActionMenu>
                        )}
                      </span>
                      <span className="text-v2-caption tabular-nums text-v2-text-3">{t("{n} xodim", { n })}</span>
                      {scopeChip(t("O'z filiallari"))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ACCESS_SECTIONS.map((sec) => (
              <Fragment key={sec.title}>
                <tr>
                  <td colSpan={colCount} className="border-b border-v2-border bg-v2-surface-2 px-0 py-1.5 text-v2-caption font-semibold text-v2-text-2">
                    <span className="sticky left-0 px-4">{t(sec.title)}</span>
                  </td>
                </tr>
                {sec.rows.map((row) => {
                  const expandable = row.kind === "normal" && row.pages.length > 1;
                  const isOpen = open.has(row.key);
                  return (
                    <Fragment key={row.key}>
                      <tr className="group">
                        <td className={`${firstCol} border-b border-v2-border py-2 pl-3 pr-2 group-hover:bg-v2-surface-2 sm:pl-4`}>
                          <div className="flex items-start gap-1.5">
                            {expandable ? (
                              <button
                                type="button"
                                onClick={() => toggleOpen(row.key)}
                                aria-expanded={isOpen}
                                title={isOpen ? t("Sahifalarni yashirish") : t("Sahifalar bo'yicha")}
                                className="-ml-1.5 mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                              >
                                <ChevronRight className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={2} aria-hidden />
                              </button>
                            ) : (
                              <span className="-ml-1.5 w-5 shrink-0" aria-hidden />
                            )}
                            <span className="min-w-0">
                              <span className="block font-semibold leading-snug text-v2-text">{t(row.label)}</span>
                              {(row.hint || row.kind !== "normal") && (
                                <span className="block text-v2-caption leading-snug text-v2-text-3">
                                  {row.kind === "always"
                                    ? t("hammaga ochiq — ichida rol bo'yicha")
                                    : row.kind === "admin"
                                      ? t("faqat administrator")
                                      : t(row.hint)}
                                  {expandable && <span className="tabular-nums"> · {t("{n} sahifa", { n: row.pages.length })}</span>}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className={`${cellBox} border-b border-v2-border group-hover:bg-v2-surface-2`}>
                          <LevelChip state={rowState(row, null, true)} t={t} />
                        </td>
                        {roles.map((r) => {
                          const access = accessOfRole(r);
                          const st = rowState(row, access);
                          const key = `${r.id}:${row.key}`;
                          const editable = row.kind === "normal" || row.kind === "self";
                          return (
                            <td key={r.id} className={`${cellBox} border-b border-v2-border group-hover:bg-v2-surface-2`}>
                              {!editable ? (
                                <span title={row.kind === "admin" ? t("Faqat administrator — rolga berilmaydi") : t("Hammaga ochiq — ichida rol bo'yicha kesiladi")}>
                                  <LevelChip state={st} t={t} />
                                </span>
                              ) : savingKey === key ? (
                                <Loader2 className="mx-auto size-4 animate-spin text-v2-text-3" strokeWidth={2} aria-label={t("Saqlanmoqda")} />
                              ) : (
                                <ActionMenu items={cellMenu(r, row)} label={`${t(r.name)} · ${t(row.label)}`} width={250} align="start">
                                  {(trigger, menuOpen) => (
                                    <button
                                      type="button"
                                      {...trigger}
                                      aria-label={`${t(r.name)} · ${t(row.label)}: ${levelText(st, t)}`}
                                      className={`inline-flex min-h-8 min-w-[5.5rem] items-center justify-center rounded-v2-md border px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                                        menuOpen ? "border-v2-brand bg-v2-surface" : "border-transparent hover:border-v2-border-strong hover:bg-v2-surface"
                                      }`}
                                    >
                                      <LevelChip state={st} t={t} />
                                    </button>
                                  )}
                                </ActionMenu>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {expandable &&
                        isOpen &&
                        row.pages.map((p) => (
                          <tr key={p.href} className="group/p">
                            <td className={`${firstCol} border-b border-v2-border bg-v2-surface-2/50 py-1.5 pl-8 pr-2 text-v2-small sm:pl-11 text-v2-text-2 group-hover/p:bg-v2-surface-2`}>
                              {t(p.label)}
                            </td>
                            <td className={`${cellBox} border-b border-v2-border bg-v2-surface-2/50 py-1.5 group-hover/p:bg-v2-surface-2`}>
                              <Check className="mx-auto size-3.5 text-v2-brand" strokeWidth={2.5} aria-label={t("Ochiq")} />
                            </td>
                            {roles.map((r) => {
                              const access = accessOfRole(r);
                              const on = access === null || access.includes(p.href);
                              const key = `${r.id}:${p.href}`;
                              const blocked = !on && lacks([p]);
                              return (
                                <td key={r.id} className={`${cellBox} border-b border-v2-border bg-v2-surface-2/50 py-1.5 group-hover/p:bg-v2-surface-2`}>
                                  {savingKey === key ? (
                                    <Loader2 className="mx-auto size-3.5 animate-spin text-v2-text-3" strokeWidth={2} aria-label={t("Saqlanmoqda")} />
                                  ) : (
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={on}
                                      disabled={blocked}
                                      title={blocked ? t("O'zingizda yo'q bo'limni bera olmaysiz") : on ? t("Yopish") : t("Ochish")}
                                      aria-label={`${t(r.name)} · ${t(p.label)}`}
                                      onClick={() => onSave(r, setPage(access, p.href, !on), key, `${t(r.name)} · ${t(p.label)} → ${on ? t("Yo'q") : t("Ochiq")}`)}
                                      className={`inline-flex h-6 min-w-[3.5rem] items-center justify-center gap-1 rounded-v2-full px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus disabled:cursor-not-allowed disabled:opacity-50 ${
                                        on ? "bg-v2-brand-bg text-v2-brand hover:brightness-95" : "text-v2-text-3 hover:bg-v2-surface hover:text-v2-text-2"
                                      }`}
                                    >
                                      {on ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : null}
                                      {on ? t("Ochiq") : t("Yo'q")}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {/* Izohlar (rasm pastidagi qator) */}
      <div className="flex flex-col gap-2 border-t border-v2-border px-4 py-3 text-v2-caption text-v2-text-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <LevelChip state={{ level: "full", on: 1, total: 1 }} t={t} />
            {t("ko'radi, qo'shadi, o'zgartiradi")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-v2-full bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-semibold text-v2-text-2">
              <span className="size-2.5 rounded-full border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" aria-hidden />
              {t("Qisman")}
            </span>
            {t("bo'limning bir qism sahifalari")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-v2-full bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-semibold text-v2-text-2">
              <Eye className="size-3" strokeWidth={2} aria-hidden />
              {t("Ko'rish")}
            </span>
            {t("faqat o'zinikini")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-v2-text-3">{t("Yo'q")}</span>
            {t("menyuda ko'rinmaydi")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3 text-v2-text-3" strokeWidth={2} aria-hidden />
            {t("Administrator huquqlari o'zgarmaydi")}
          </span>
        </div>
        <p className="text-v2-text-3">
          {t("Doira: administrator — hamma filial; qolganlar — xodimga biriktirilgan filiallar (xodim kartasida). Bo'limdagi sahifalar «›» bilan alohida ochiladi.")}
        </p>
        <p className="text-v2-text-3">
          {t("Shaxsiy bo'limlar hammada bor: Bosh sahifa, Profil, o'z topshiriqlari. Har o'zgarish Amallar jurnaliga yoziladi.")}
        </p>
      </div>
    </div>
  );
}
