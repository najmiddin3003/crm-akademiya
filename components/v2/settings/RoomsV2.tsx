"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, DoorOpen, Info, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useT } from "@/components/shared/Language";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu from "@/components/v2/ui/ActionMenu";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_BG, FAN_BORDER, FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { ROW_TINT } from "@/components/v2/ui/table";
import { invalidateRooms } from "@/hooks/useRooms";
import { groupLabel } from "@/lib/groups";
import { branchHours, weeklyOpenMinutes, workDaysLabel } from "@/lib/managementBranches";
import { freeEdges, groupsInRoomOf, hoursLabel, roomLoad, type OverviewGroup, type RoomLoad, type RoomsOverview } from "@/lib/roomOccupancy";
import type { RoomGroup } from "@/lib/roomBranch";
import { roomBranchId, type Room } from "@/lib/rooms";
import RoomDialogV2 from "./RoomDialogV2";

// YANGI VERSIYA — «SOZLAMALAR → UMUMIY → XONALAR» (23-qism, rasmlar «Sozlamalar · Xonalar ·
// Yorug'/Qorong'i», 13.11.2026).
//
//   • Filial chiplari — ruxsat etilgan har bino (1+2 hovuzida ham alohida: xona jismoniy)
//     va undagi xonalar soni; sukut — navbardagi filial. Navbar filiali o'zgarmaydi.
//   • Ogohlantirish — xona sig'imidan ko'p o'quvchili guruh. Guruhda «sig'im» maydoni
//     YO'Q, shuning uchun guruhdagi HOZIRGI o'quvchilar soni bilan solishtiriladi.
//   • Haftalik bandlik — tirik guruhlarning hafta kunlari × dars davomiyligi, maxraj —
//     filialning ish vaqti (lib/managementBranches.ts branchHours; kiritilmagan bo'lsa
//     08:00–22:00, Du–Sha). Hisob lib/roomOccupancy.ts da.
//   • O'chirish TO'SILMAYDI (27.09.2026 egasi qarori, memory xonalar-filial-tanlovi):
//     guruhli xonada ogohlantirish, guruhlar eski nomni saqlaydi.
//
// Ma'lumot BITTA so'rov: GET /api/rooms?view=overview (xonalar + tirik guruhlar + filiallar
// ish vaqti) — /groups-rooms ruxsati /api/groups va /api/branches ga yetmaydi.

const TH = "sticky top-0 z-[1] bg-v2-surface-2 px-4 py-2.5 text-left text-v2-caption font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
const TD = "px-4 py-3 align-middle";
/** Bir katakda ko'rinadigan guruh chiplari — qolgani «+N». */
const SHOWN_CHIPS = 3;

function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => a.name.localeCompare(b.name, "uz", { numeric: true, sensitivity: "base" }));
}

function GroupChip({ g }: { g: OverviewGroup }) {
  const fan = fanOf(g.course);
  const title = `${groupLabel(g)} · ${g.day} · ${timeLabel(g.time)}`;
  return (
    <span title={title} className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-v2-sm border px-2 py-0.5 text-v2-caption ${FAN_BG[fan]} ${FAN_BORDER[fan]}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${FAN_DOT[fan]}`} aria-hidden />
      <span className="truncate font-medium text-v2-text">{g.course || groupLabel(g)}</span>
      {g.time && <span className="shrink-0 font-normal text-v2-text-2">· {timeLabel(g.time)}</span>}
    </span>
  );
}

function LoadCell({ load }: { load: RoomLoad }) {
  const { t } = useT();
  return (
    <div className="w-36">
      <div className="text-v2-small text-v2-text-2">
        <span className="font-semibold tabular-nums text-v2-text">{hoursLabel(load.busy)}</span>
        <span className="tabular-nums"> / {t("{n} soat", { n: hoursLabel(load.open) })} · {load.pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-v2-full bg-v2-track" role="presentation">
        <div className="h-full rounded-v2-full bg-v2-brand" style={{ width: `${Math.min(100, load.pct)}%` }} />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <tr key={i} className="border-t border-v2-border">
          <td className={TD}>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-v2-md bg-v2-skeleton" />
              <div className="h-3 w-20 rounded bg-v2-skeleton" />
            </div>
          </td>
          <td className={TD}>
            <div className="h-3 w-14 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-5 w-40 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-3 w-28 rounded bg-v2-skeleton" />
            <div className="mt-2 h-1.5 w-36 rounded bg-v2-skeleton" />
          </td>
          <td className={TD}>
            <div className="h-3 w-10 rounded bg-v2-skeleton" />
          </td>
          <td className={TD} />
        </tr>
      ))}
    </>
  );
}

export default function RoomsV2() {
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { branchId: navBranch } = useBranch();
  const canSchedule = useCanOpen("/groups-schedule");
  const [data, setData] = useState<RoomsOverview | null>(null);
  const [err, setErr] = useState("");
  const [version, setVersion] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ room: Room | null } | null>(null);
  const [del, setDel] = useState<{ room: Room; groups: RoomGroup[] | null } | null>(null);

  useEffect(() => {
    let off = false;
    fetch("/api/rooms?view=overview")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (off) return;
        if (!r.ok || !d.ok) {
          setErr(d.error || "Yuklanmadi");
          return;
        }
        setErr("");
        setData(d as RoomsOverview);
      })
      .catch(() => {
        if (!off) setErr("Serverga ulanib bo'lmadi");
      });
    return () => {
      off = true;
    };
  }, [version]);
  const reload = () => setVersion((v) => v + 1);

  // Tanlangan bino: foydalanuvchi bosgani, aks holda navbardagi (ro'yxatda bo'lsa), so'ng server aytgani.
  // (React Compiler o'zi yodlab qoladi — qo'lda useMemo shart emas.)
  const branches = data?.branches ?? [];
  const ids = branches.map((b) => b.id);
  const sel =
    picked !== null && ids.includes(picked)
      ? picked
      : navBranch !== null && ids.includes(navBranch)
        ? navBranch
        : data && ids.includes(data.current)
          ? data.current
          : (ids[0] ?? null);

  const branch = branches.find((b) => b.id === sel) ?? null;
  const hours = branchHours(branch);
  const openMin = weeklyOpenMinutes(hours);
  const daysText = t(workDaysLabel(hours.days));

  const countOf = new Map<number, number>();
  for (const r of data?.rooms ?? []) countOf.set(roomBranchId(r), (countOf.get(roomBranchId(r)) ?? 0) + 1);

  const rows =
    data && sel !== null
      ? sortRooms(data.rooms.filter((r) => roomBranchId(r) === sel)).map((room) => ({ room, load: roomLoad(room, data.groups, openMin) }))
      : [];

  const issues = rows.flatMap((r) => r.load.over.map((o) => ({ room: r.room, ...o })));
  const busyTotal = rows.reduce((s, r) => s + r.load.busy, 0);
  const openTotal = openMin * rows.length;
  const freePct = openTotal > 0 ? Math.max(0, 100 - Math.round((busyTotal / openTotal) * 100)) : 0;
  const edges = freeEdges(
    rows.flatMap((r) => r.load.groups),
    hours,
  );
  const edgeText =
    freePct < 20
      ? ""
      : edges.morning && edges.evening
        ? t("ertalab va kechqurun yangi guruh uchun joy bor.")
        : edges.morning
          ? t("ertalab yangi guruh uchun joy bor.")
          : edges.evening
            ? t("kechqurun yangi guruh uchun joy bor.")
            : t("yangi guruh uchun joy bor.");

  function openDelete(room: Room) {
    setDel({ room, groups: null });
    fetch(`/api/rooms/${room.id}`)
      .then((r) => r.json())
      .then((d) => setDel((cur) => (cur && cur.room.id === room.id ? { room, groups: d.ok && Array.isArray(d.groups) ? d.groups : [] } : cur)))
      // Tekshiruv yiqilsa ham o'chirish ishlayversin — ro'yxat sahifadagi hisobdan.
      .catch(() => setDel((cur) => (cur && cur.room.id === room.id ? { room, groups: [] } : cur)));
  }

  async function doDelete(room: Room) {
    setDel(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        showError(t(d.error || "O'chirilmadi"));
        return;
      }
      invalidateRooms();
      showSuccess(t("«{name}» o'chirildi", { name: roomLabel(room.name) }));
      reload();
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    }
  }

  // O'chirish oynasidagi guruhlar: serverdan kelguncha — sahifadagi hisobdan (bir xil qoida).
  // Server ro'yxatida faqat guruh raqami bor — kurs nomi sahifadagi ma'lumotdan.
  const labelOf = (g: RoomGroup) => {
    const own = data?.groups.find((x) => x.id === g.id);
    return own ? groupLabel(own) : groupLabel({ id: g.id, name: g.name, course: "" });
  };
  const delGroups: { id: number; label: string; day: string; time: string }[] | null = del
    ? del.groups
      ? del.groups.map((g) => ({ id: g.id, label: labelOf(g), day: g.day, time: g.time }))
      : data
        ? groupsInRoomOf(del.room, data.groups).map((g) => ({ id: g.id, label: groupLabel(g), day: g.day, time: g.time }))
        : null
    : null;

  return (
    <div className="flex min-h-full shrink-0 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[44rem]">
          <div className="text-v2-caption text-v2-text-2">{t("Umumiy")}</div>
          <h1 className="mt-0.5 text-[20px] font-semibold leading-7 text-v2-text">{t("Xonalar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Dars jadvali xonalar bo'yicha chiziladi. Bandlik ish vaqtidan ({from}–{to}, {days} = {n} soat) hisoblanadi.", {
              from: hours.from,
              to: hours.to,
              days: daysText,
              n: hoursLabel(openMin),
            })}
          </p>
        </div>
        <button type="button" onClick={() => setDialog({ room: null })} disabled={!data} className={`${primaryBtn} disabled:opacity-60`}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Xona qo'shish")}
        </button>
      </div>

      {err ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6">
          <p className="text-v2-body text-v2-text-2">{t(err)}</p>
          <button type="button" onClick={reload} className={`${secondaryBtn} mt-3`}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Qayta urinish")}
          </button>
        </div>
      ) : (
        <>
          {/* 2. Filial chiplari */}
          {branches.length > 1 && (
            <div role="tablist" aria-label={t("Filial")} className="flex flex-wrap gap-2">
              {branches.map((b) => {
                const on = b.id === sel;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setPicked(b.id)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                      on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
                    }`}
                  >
                    {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
                    {b.name}
                    <span className={on ? "text-v2-brand-text" : "text-v2-text-3"}>· {countOf.get(b.id) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Sig'im ogohlantirishi */}
          {issues.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-v2-md border border-v2-warning/30 bg-v2-warning-bg px-3 py-2.5 text-v2-small text-v2-text">
              <AlertTriangle className="size-4 shrink-0 text-v2-warning" strokeWidth={2} aria-hidden />
              <span className="min-w-0 flex-1">
                {t("{room}: {cap} o'rin, «{group}» guruhida {n} o'quvchi — {d} kishiga joy yetmaydi.", {
                  room: roomLabel(issues[0].room.name),
                  cap: issues[0].room.capacity,
                  group: issues[0].group.course || groupLabel(issues[0].group),
                  n: issues[0].group.students,
                  d: issues[0].lack,
                })}
                {issues.length > 1 && <span className="text-v2-text-2"> {t("Yana {n} ta shunday guruh bor.", { n: issues.length - 1 })}</span>}
              </span>
              <Link href={`/groups/${issues[0].group.id}`} className="shrink-0 font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                {t("Guruhni ochish")}
              </Link>
            </div>
          )}

          {/* 4. Jadval */}
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-v2-body">
                <thead>
                  <tr>
                    <th className={TH}>{t("Xona")}</th>
                    <th className={TH}>{t("Sig'im")}</th>
                    <th className={TH}>{t("Guruhlar")}</th>
                    <th className={TH}>{t("Haftalik bandlik")}</th>
                    <th className={TH}>{t("Holat")}</th>
                    <th className={`${TH} w-20`}>
                      <span className="sr-only">{t("Amallar")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!data && <SkeletonRows />}
                  {data && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <DoorOpen className="mx-auto size-8 text-v2-text-3" strokeWidth={1.5} aria-hidden />
                        <p className="mt-2 text-v2-body font-medium text-v2-text">{t("Bu filialda hali xona yo'q")}</p>
                        <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Xona qo'shilgach, guruh ochishda tanlanadi va bandligi shu yerda ko'rinadi.")}</p>
                      </td>
                    </tr>
                  )}
                  {rows.map(({ room, load }) => {
                    const warn = load.over.length > 0;
                    const maxStudents = Math.max(0, ...load.over.map((o) => o.group.students));
                    return (
                      <tr key={room.id} className={warn ? ROW_TINT.warning : ROW_TINT.hover}>
                        <td className={`${TD} border-t border-v2-border`}>
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-text-2" aria-hidden>
                              <DoorOpen className="size-4" strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-v2-text">{roomLabel(room.name)}</span>
                              {room.note && <span className="block max-w-[12rem] truncate text-v2-caption font-normal text-v2-text-3">{room.note}</span>}
                            </span>
                          </div>
                        </td>
                        <td className={`${TD} border-t border-v2-border`}>
                          {room.capacity > 0 ? (
                            warn ? (
                              <div>
                                <div className="flex items-center gap-1 font-semibold text-v2-warning">
                                  <AlertTriangle className="size-3.5" strokeWidth={2} aria-hidden />
                                  {t("{n} o'rin", { n: room.capacity })}
                                </div>
                                <div className="text-v2-caption text-v2-warning">{t("guruhda {n} o'quvchi", { n: maxStudents })}</div>
                              </div>
                            ) : (
                              <span className="font-semibold text-v2-text">{t("{n} o'rin", { n: room.capacity })}</span>
                            )
                          ) : (
                            <span className="text-v2-text-3">—</span>
                          )}
                        </td>
                        <td className={`${TD} border-t border-v2-border`}>
                          {load.groups.length === 0 ? (
                            <span className="text-v2-small text-v2-text-3">{t("Bo'sh")}</span>
                          ) : (
                            <div className="flex max-w-[22rem] flex-wrap gap-1.5">
                              {load.groups.slice(0, SHOWN_CHIPS).map((g) => (
                                <GroupChip key={g.id} g={g} />
                              ))}
                              {load.groups.length > SHOWN_CHIPS && (
                                <span
                                  title={load.groups
                                    .slice(SHOWN_CHIPS)
                                    .map((g) => `${groupLabel(g)} · ${timeLabel(g.time)}`)
                                    .join("\n")}
                                  className="inline-flex items-center rounded-v2-sm border border-v2-border bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-medium text-v2-text-2"
                                >
                                  +{load.groups.length - SHOWN_CHIPS}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={`${TD} border-t border-v2-border`}>
                          <LoadCell load={load} />
                        </td>
                        <td className={`${TD} border-t border-v2-border`}>
                          <span className="inline-flex items-center gap-1.5 text-v2-small text-v2-text">
                            <span className="size-1.5 rounded-full bg-v2-success" aria-hidden />
                            {t("Faol")}
                          </span>
                        </td>
                        <td className={`${TD} border-t border-v2-border`}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDialog({ room })}
                              title={t("Tahrirlash")}
                              aria-label={t("Tahrirlash")}
                              className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus"
                            >
                              <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                            </button>
                            <ActionMenu
                              label={t("Amallar")}
                              items={[
                                { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setDialog({ room }) },
                                { key: "div", divider: true },
                                { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => openDelete(room) },
                              ]}
                            >
                              {(trigger, open) => (
                                <button
                                  type="button"
                                  {...trigger}
                                  aria-label={t("Amallar")}
                                  className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2 text-v2-text" : ""}`}
                                >
                                  <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
                                </button>
                              )}
                            </ActionMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. Pastki qator */}
            {data && rows.length > 0 && branch && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-v2-border bg-v2-surface-2 px-4 py-2.5 text-v2-small text-v2-text-2">
                <p className="min-w-0">
                  {t("«{branch}» xonalari haftada {busy} / {total} soat band — {free}% vaqt bo'sh", {
                    branch: branch.name,
                    busy: hoursLabel(busyTotal),
                    total: hoursLabel(openTotal),
                    free: freePct,
                  })}
                  {edgeText ? `: ${edgeText}` : "."}
                </p>
                {canSchedule && (
                  <Link href="/groups-schedule" className="inline-flex shrink-0 items-center gap-1 font-semibold text-v2-brand-text underline-offset-2 hover:underline">
                    {t("Dars jadvali")}
                    <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* 6. Izoh */}
          <p className="flex items-start gap-2 text-v2-caption text-v2-text-2">
            <Info className="mt-px size-3.5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <span>
              {t(
                "Xona sig'imi guruhdagi o'quvchilar sonidan kichik bo'lsa — ogohlantirish chiqadi. Guruhi bor xonani o'chirishda ogohlantiriladi: guruhlar xona nomini saqlab qoladi, shu nomli xona qayta qo'shilsa o'zi ulanadi.",
              )}
            </span>
          </p>
        </>
      )}

      {/* ── Oynalar ── */}
      {dialog && data && (
        <RoomDialogV2
          room={dialog.room}
          branches={data.branches}
          allowed={data.allowed}
          defaultBranch={sel !== null && data.allowed.includes(sel) ? sel : data.current}
          onClose={() => setDialog(null)}
          onSaved={({ room, message }) => {
            showSuccess(message);
            // Boshqa binoga qo'shilgan/ko'chgan xona — o'sha chip ochiladi (yo'qolib qolmasin).
            setPicked(roomBranchId(room));
            reload();
          }}
        />
      )}
      {del && (
        <V2Confirm
          title={t("«{name}» xonasini o'chirasizmi?", { name: roomLabel(del.room.name) })}
          body={
            delGroups === null ? (
              t("Tekshirilmoqda…")
            ) : delGroups.length === 0 ? (
              t("Bu xonada dars o'tadigan guruh yo'q.")
            ) : (
              <div>
                <p>{t("Bu xonada {n} ta guruh dars o'tadi — ular xona nomini saqlab qoladi, lekin xona ro'yxatda bo'lmaydi:", { n: delGroups.length })}</p>
                <ul className="mt-1.5 space-y-0.5 text-v2-text">
                  {delGroups.slice(0, 5).map((g) => (
                    <li key={g.id} className="truncate">
                      {g.label} · {g.day} · {timeLabel(g.time)}
                    </li>
                  ))}
                  {delGroups.length > 5 && <li className="text-v2-text-2">{t("va yana {n} ta", { n: delGroups.length - 5 })}</li>}
                </ul>
              </div>
            )
          }
          confirmLabel={t("O'chirish")}
          onCancel={() => setDel(null)}
          onConfirm={() => void doDelete(del.room)}
        />
      )}
    </div>
  );
}
