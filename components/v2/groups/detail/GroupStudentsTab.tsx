"use client";

import { useState } from "react";
import { ArrowRightLeft, Coins, MoreHorizontal, Search, SquareArrowOutUpRight, UserMinus, UserPlus, Users, X } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { initialsOf } from "@/components/v2/employees/employeeBits";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { ROW_TINT } from "@/components/v2/ui/table";
import { EmptyBlock, PUPIL_TONE, ToneBadge, phoneParts, secondarySm, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import type { Group } from "@/lib/groups";
import { cameStatus, memberName, type Member } from "./groupDetailBits";
import { useGamView, useMonthMarks } from "./useGroupDetail";

// YANGI VERSIYA — GURUH «O'QUVCHILAR» TABI (24.10.2026). Bu tabning rasmi yo'q
// (SAVOLLAR 165): yangi versiyaning jadval qolipida — ism (profilga havola), telefon,
// guruhga qo'shilgan kun, shu oy davomati, tanga; qatordagi «⋯» — profil, boshqa
// guruhga ko'chirish, guruhdan chiqarish (eski sahifadagi bilan bir xil so'rovlar —
// GroupDetailV2 da). Balans, «Oxirgi izoh» — eski ko'rinishda.

const th = "whitespace-nowrap bg-v2-surface-2 px-2.5 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";

export default function GroupStudentsTab({
  group,
  members,
  today,
  onAdd,
  onMove,
  onRemove,
}: {
  group: Group & { branchId?: number | null };
  members: Member[] | null;
  today: string;
  onAdd: () => void;
  onMove: (m: Member) => void;
  onRemove: (m: Member) => void;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const canProfile = useCanOpen("/students-list");
  const month = today.slice(0, 7);
  const { marks } = useMonthMarks(group.id, month);
  const { view } = useGamView(group.id, "");
  const [q, setQ] = useState("");

  const gam = view && view.enabled && view.group ? view : null;
  const balance = new Map((gam?.rows ?? []).map((r) => [r.pupilId, r.balance]));
  const stats = new Map<number, { came: number; marked: number }>();
  for (const m of marks ?? []) {
    if (m.date > today) continue;
    const s = stats.get(m.pupilId) ?? { came: 0, marked: 0 };
    s.marked += 1;
    if (cameStatus(m.status)) s.came += 1;
    stats.set(m.pupilId, s);
  }

  const all = [...(members ?? [])].sort((a, b) => memberName(a).localeCompare(memberName(b), "uz"));
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const list = needle ? all.filter((m) => memberName(m).toLowerCase().includes(needle) || (digits.length >= 2 && (m.phone || "").replace(/\D/g, "").includes(digits))) : all;
  const frozen = all.filter((m) => m.status === "Muzlatilgan").length;

  if (members !== null && members.length === 0) {
    return (
      <div className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <EmptyBlock
          icon={<Users className="size-5" strokeWidth={1.75} />}
          title={t("Guruhda hali o'quvchi yo'q")}
          text={t("O'quvchi qo'shing — davomat va tangalar shu yerda belgilanadi.")}
          action={
            <button type="button" onClick={onAdd} className={secondarySm}>
              <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
              {t("O'quvchi qo'shish")}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="relative w-full min-[40rem]:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Ism yoki telefon")}
            aria-label={t("O'quvchini qidirish")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface pl-9 pr-8 text-v2-body text-v2-text placeholder:text-v2-text-3 focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t("Tozalash")} className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-v2-sm text-v2-text-3 hover:text-v2-text">
              <X className="size-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-v2-small text-v2-text-2">
          <span>
            <b className="font-semibold tabular-nums text-v2-text">{members === null ? "—" : all.length}</b> {t("ta o'quvchi")}
          </span>
          {frozen > 0 && (
            <>
              <span aria-hidden>•</span>
              <span>
                {t("Muzlatilgan")} <b className="font-semibold tabular-nums text-v2-text">{frozen}</b>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-v2-body">
            <thead>
              <tr>
                <th className={`${th} w-12 pl-4`}>№</th>
                <th className={th}>{t("O'quvchi")}</th>
                <th className={th}>{t("Telefon")}</th>
                <th className={th}>{t("Qo'shilgan")}</th>
                <th className={`${th} text-right`}>{t("Davomat · {month}", { month: fmt.monthLower(month) })}</th>
                {gam && <th className={`${th} text-right`}>{t("Tanga")}</th>}
                <th className={`${th} w-11 pr-3`}>
                  <span className="sr-only">{t("Amallar")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members === null &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`} className="h-[52px] border-b border-v2-border" aria-hidden>
                    <td className="py-2.5 pl-4">
                      <div className="h-3 w-4 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5">
                      <div className="h-3 w-40 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5">
                      <div className="h-3 w-24 rounded bg-v2-skeleton" />
                    </td>
                    <td className="px-2.5">
                      <div className="h-3 w-20 rounded bg-v2-skeleton" />
                    </td>
                    <td />
                    {gam && <td />}
                    <td />
                  </tr>
                ))}
              {members !== null && list.length === 0 && (
                <tr>
                  <td colSpan={gam ? 7 : 6} className="px-4 py-10 text-center text-v2-small text-v2-text-2">
                    {t("Mos o'quvchi topilmadi")}
                  </td>
                </tr>
              )}
              {list.map((m, i) => {
                const name = memberName(m) || t("Nomsiz o'quvchi");
                const ph = phoneParts(m.phone || "");
                const s = stats.get(m.id);
                const pct = s && s.marked ? Math.round((s.came / s.marked) * 100) : null;
                const tone = m.status === "Muzlatilgan" || m.status === "Arxiv" ? PUPIL_TONE[m.status] : null;
                const items: ActionMenuEntry[] = [
                  { key: "h", heading: name },
                  ...(canProfile ? [{ key: "open", label: t("Profilni ochish"), icon: SquareArrowOutUpRight, href: `/student-edit/${m.id}?src=list` } as ActionMenuEntry] : []),
                  { key: "move", label: t("Boshqa guruhga ko'chirish"), icon: ArrowRightLeft, onSelect: () => onMove(m) },
                  { key: "d", divider: true },
                  { key: "remove", label: t("Guruhdan chiqarish"), icon: UserMinus, danger: true, onSelect: () => onRemove(m) },
                ];
                return (
                  <tr key={m.id} className={`group h-[52px] border-b border-v2-border transition-colors last:border-b-0 ${ROW_TINT.hover}`}>
                    <td className="py-2.5 pl-4 pr-2.5 text-v2-small tabular-nums text-v2-text-3">{i + 1}</td>
                    <td className="px-2.5 py-2.5">
                      <span className="flex min-w-[12rem] items-center gap-2">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[11px] font-semibold text-v2-text-2" aria-hidden>
                          {initialsOf(name)}
                        </span>
                        {canProfile ? (
                          <Link href={`/student-edit/${m.id}?src=list`} className="truncate font-semibold text-v2-text underline-offset-2 hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="truncate font-semibold text-v2-text">{name}</span>
                        )}
                        {tone && <ToneBadge tone={tone}>{t(tone.label)}</ToneBadge>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums">
                      {ph ? (
                        <a href={`tel:${ph.tel}`} className="text-v2-text underline-offset-2 hover:underline" title={t("Qo'ng'iroq qilish")}>
                          {ph.show}
                        </a>
                      ) : (
                        <span className="text-v2-text-3">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 tabular-nums text-v2-text-2">{m.joinedAt ? fmt.ddmmyyyy(m.joinedAt) : m.createdAt || "—"}</td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums">
                      {pct === null ? (
                        <span className="text-v2-text-3">—</span>
                      ) : (
                        <span className={`font-semibold ${pct < 70 ? "text-v2-danger" : "text-v2-text"}`} title={t("{came} / {marked} dars", { came: s?.came ?? 0, marked: s?.marked ?? 0 })}>
                          {pct}%
                        </span>
                      )}
                    </td>
                    {gam && (
                      <td className="whitespace-nowrap px-2.5 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-v2-text">
                          <Coins className="size-3.5 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                          {balance.get(m.id) ?? "—"}
                        </span>
                      </td>
                    )}
                    <td className="py-2.5 pl-1 pr-3 text-right">
                      <ActionMenu items={items} label={t("{name} — amallar", { name })} width={232}>
                        {(trigger, open) => (
                          <button
                            type="button"
                            {...trigger}
                            title={t("Amallar")}
                            aria-label={t("{name} — amallar", { name })}
                            className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-[opacity,background-color] hover:bg-v2-surface-2 hover:text-v2-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-v2-focus [@media(hover:none)]:opacity-100 ${
                              open ? "bg-v2-surface-2 opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <MoreHorizontal className="size-4" strokeWidth={1.75} />
                          </button>
                        )}
                      </ActionMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
