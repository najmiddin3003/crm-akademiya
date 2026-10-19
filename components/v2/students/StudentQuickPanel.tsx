"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CirclePlus,
  Copy,
  History,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  Phone,
  Receipt,
  SquareArrowOutUpRight,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { prefetchStudentPayment } from "@/components/v2/finance/StudentPaymentModalV2";
import type { Group } from "@/lib/groups";
import type { EnrichedStudent } from "@/lib/studentsData";

// O'QUVCHI TEZKOR PANELI (rasm «O'quvchi · Tezkor panel», 18.10.2026): ro'yxatda
// o'quvchi bosilganda o'ngdan chiqadi — profilga o'tmasdan eng kerakli narsa:
//
//   sarlavha: avatar, ism, holat («Yangi o'quvchi» …), kurs · xona; to'liq
//             profil va yopish;
//   amallar:  «To'lov qabul qilish» (shu yerda oyna — components/v2/finance/
//             StudentPaymentModalV2.tsx; faqat Kassaga ruxsati borga), SMS,
//             qo'ng'iroq, «⋯»;
//   Balans | Tanga; Ma'lumotlar; Guruh (kartalar); To'lovlar (oxirgi 5 ta);
//   Tarix.
//
// Ma'lumot: qator (useStudentsList) + uchta yengil so'rov — hammasi
// /students-list ga allaqachon ruxsat etilgan (lib/apiPermissions.generated.ts):
//   /api/transaction-entries?pupilId — to'lovlar (profil bilan bir manba);
//   /api/groups/:id/students — guruhga QO'SHILGAN SANA (group_memberships);
//   /api/pupils/:id — o'quvchi filiali.
// TARIX: profildagi «Harakatlar» manbasi (`pupil_activity`) HECH QACHON
// yozilmaydi — shu bois tarix mavjud ma'lumotdan yig'iladi: guruhga qo'shilish/
// chiqish, holat o'zgarishi, ro'yxatga olingan kun va manba
// (design/v2/SAVOLLAR.md, 36–40).
//
// Panel o'quvchi almashganda `key` bilan qaytadan yaratiladi — holat o'zidan tozalanadi.

interface Payment {
  id: number;
  date: string;
  amount: number;
  txName: string;
  paymentType: string;
  periodMonth?: string;
  status: string;
}

interface Membership {
  joinedAt: string | null;
}

const STATUS_TONE = {
  new: { label: "Yangi o'quvchi", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  Aktiv: { label: "Aktiv", badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  Muzlatilgan: { label: "Muzlatilgan", badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  Arxiv: { label: "Arxiv", badge: "bg-v2-surface-2 text-v2-text-2", dot: "bg-v2-text-3" },
} as const;

function fmtNum(n: number): string {
  const s = Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ");
  return n < 0 ? `−${s}` : s;
}

/** 9 raqam → «93 657 37 00» va qo'ng'iroq uchun «+998936573700». */
function phoneParts(raw: string): { show: string; tel: string; copy: string } | null {
  const d = (raw || "").replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  if (local.length !== 9) return raw ? { show: raw, tel: raw.replace(/\s/g, ""), copy: raw } : null;
  const show = `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  return { show, tel: `+998${local}`, copy: `+998 ${show}` };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** "YYYY-MM-DD" yoki "DD.MM.YYYY" → [yil, oy, kun]; o'qilmasa null. */
function parseDay(s: string | null | undefined): [number, number, number] | null {
  const v = (s || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v);
  if (m) return [Number(m[3]), Number(m[2]), Number(m[1])];
  return null;
}

export default function StudentQuickPanel({
  row,
  groups,
  onClose,
  onSms,
  onPay,
  onAddToGroup,
  onChangeStatus,
}: {
  row: EnrichedStudent;
  groups: Group[];
  onClose: () => void;
  onSms: () => void;
  /** «To'lov qabul qilish» oynasi (o'quvchi tanlangan holda). */
  onPay: () => void;
  onAddToGroup: () => void;
  onChangeStatus: () => void;
}) {
  const { t, lang, months } = useT();
  const branch = useBranch();
  const { showSuccess } = useToast();
  const canPay = useCanOpen("/finance-cash");
  const canGroups = useCanOpen("/groups");
  const closeRef = useRef<HTMLButtonElement>(null);

  const [payments, setPayments] = useState<{ loading: boolean; list: Payment[]; total: number }>({ loading: true, list: [], total: 0 });
  const [joined, setJoined] = useState<Record<number, Membership>>({});
  const [branchId, setBranchId] = useState<number | null>(null);

  const myGroups = useMemo(() => groups.filter((g) => row.groupIds.includes(g.id)), [groups, row.groupIds]);
  const groupKey = myGroups.map((g) => g.id).join(",");

  // Ochilganda fokus — klaviatura bilan ishlovchi panelda ekanini bilsin (Esc — yopadi).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transaction-entries?pupilId=${row.id}&txType=payIn&excludeCancelled=1&limit=5&page=1`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPayments({ loading: false, list: d.ok ? (d.entries as Payment[]) : [], total: d.ok ? Number(d.total) || d.entries.length : 0 });
      })
      .catch(() => { if (!cancelled) setPayments({ loading: false, list: [], total: 0 }); });
    fetch(`/api/pupils/${row.id}`)
      .then((r) => r.json())
      .then((d) => {
        const id = Number(d?.pupil?.branchId);
        if (!cancelled && d.ok) setBranchId(Number.isFinite(id) && id > 0 ? id : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [row.id]);

  // Guruhga qo'shilgan sana — har guruhning a'zolari ro'yxatidan (group_memberships).
  useEffect(() => {
    if (!groupKey) return;
    let cancelled = false;
    const ids = groupKey.split(",").map(Number).slice(0, 4);
    Promise.all(
      ids.map((gid) =>
        fetch(`/api/groups/${gid}/students`)
          .then((r) => r.json())
          .then((d) => {
            const me = d.ok ? (d.students as { id: number; joinedAt?: string }[]).find((s) => s.id === row.id) : undefined;
            return [gid, { joinedAt: me?.joinedAt ?? null }] as const;
          })
          .catch(() => [gid, { joinedAt: null }] as const),
      ),
    ).then((list) => {
      if (!cancelled) setJoined(Object.fromEntries(list));
    });
    return () => { cancelled = true; };
  }, [groupKey, row.id]);

  /* ---- Ko'rinish uchun hisoblar ---- */
  const phone = phoneParts(row.phone);
  const first = myGroups[0];
  const sub = first ? [first.course, roomLabel(first.room)].filter(Boolean).join(" · ") : "";
  // «Yangi o'quvchi» — faol, lekin hali bir marta ham to'lamagan (SAVOLLAR 36).
  const tone = row.status === "Aktiv" && row.balance === 0 ? STATUS_TONE.new : STATUS_TONE[row.status] ?? STATUS_TONE.Aktiv;
  const branchName =
    branch.branches.find((b) => b.id === (branchId ?? branch.branchId))?.name ?? "";
  const firstJoined = first ? joined[first.id]?.joinedAt ?? null : null;

  const day = (s: string | null | undefined, withTime?: string): string => {
    const p = parseDay(s);
    if (!p) return "";
    const [y, m, d] = p;
    const month = months[m - 1] ?? "";
    const thisYear = y === new Date().getFullYear();
    const base = lang === "en" ? `${month} ${d}` : `${d}-${month.toLowerCase()}`;
    return `${base}${thisYear ? "" : ` ${y}`}${withTime ? ` | ${withTime}` : ""}`;
  };
  const ddmmyyyy = (s: string | null | undefined): string => {
    const p = parseDay(s);
    return p ? `${String(p[2]).padStart(2, "0")}.${String(p[1]).padStart(2, "0")}.${p[0]}` : "";
  };

  // Tarix — mavjud ma'lumotdan (yuqoridagi izoh). Yangisi tepada. Bir necha
  // qator — har chizishda hisoblash arzon.
  const history = (() => {
    const items: { key: string; title: string; when: string; sort: number }[] = [];
    const sortOf = (s: string | null | undefined, time = "") => {
      const p = parseDay(s);
      return p ? Number(`${p[0]}${String(p[1]).padStart(2, "0")}${String(p[2]).padStart(2, "0")}${time.replace(":", "") || "0000"}`) : 0;
    };
    for (const g of myGroups) {
      const at = joined[g.id]?.joinedAt;
      if (at) items.push({ key: `g${g.id}`, title: t("{course} guruhiga qo'shildi", { course: g.course || g.name }), when: day(at), sort: sortOf(at, "2359") });
    }
    if (row.status !== "Aktiv" && row.statusChangedAt) {
      const what = row.status === "Arxiv" ? t("Arxivga o'tkazildi") : t("Muzlatildi");
      items.push({ key: "status", title: row.statusReason ? `${what} · ${row.statusReason}` : what, when: day(row.statusChangedAt), sort: sortOf(row.statusChangedAt, "2359") });
    }
    const [cDate, cTime] = (row.createdAt || "").split("|").map((s) => s.trim());
    if (cDate) {
      items.push({
        key: "created",
        title: row.source ? t("O'quvchi qo'shildi · manba: {source}", { source: t(row.source) }) : t("O'quvchi qo'shildi"),
        when: day(cDate, cTime),
        sort: sortOf(cDate, cTime),
      });
    }
    return items.sort((a, b) => b.sort - a.sort);
  })();

  const profile = `/student-edit/${row.id}`;
  const base = `${profile}?src=list`;
  const menu: ActionMenuEntry[] = [
    { key: "group", label: t("Guruhga qo'shish"), icon: CirclePlus, onSelect: onAddToGroup },
    { key: "status", label: t("Holatni o'zgartirish"), icon: UserCog, onSelect: onChangeStatus },
    { key: "d", divider: true },
    { key: "smslog", label: t("SMS tarixi"), icon: MessagesSquare, href: `${base}&tab=sms` },
    { key: "groups", label: t("Guruhlar"), icon: Users, href: `${base}&tab=guruh` },
    { key: "tasks", label: t("Vazifalar"), icon: ListChecks, href: `${base}&tab=vazifa` },
    { key: "history", label: t("Tarix"), icon: History, href: `${base}&tab=harakatlar` },
  ];

  // Ikonka tugmalari: o'lcham va chegara alohida — bir klass ikkinchisini bosib qolmasin.
  const iconBase =
    "inline-flex shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus";
  const iconBtn = `${iconBase} size-9 border border-v2-border-strong bg-v2-surface`;
  const iconSmall = `${iconBase} size-8 border border-v2-border-strong bg-v2-surface`;
  const section = "mb-2.5 text-v2-small font-semibold text-v2-text";

  return (
    <aside role="dialog" aria-modal="true" aria-label={row.name} className="flex h-full w-full flex-col border-l border-v2-border bg-v2-surface text-v2-text shadow-v2-md">
      {/* Sarlavha va amallar */}
      <header className="shrink-0 border-b border-v2-border px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-body font-semibold text-v2-text-2" aria-hidden>
            {initialsOf(row.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-v2-section text-v2-text" title={row.name}>{row.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span title={row.statusReason ? `${t("Sabab")}: ${row.statusReason}` : undefined} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-v2-full px-2 py-0.5 text-v2-caption ${tone.badge}`}>
                <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
                {t(tone.label)}
              </span>
              {sub && <span className="truncate text-v2-small text-v2-text-2">{sub}</span>}
            </div>
          </div>
          <Link href={profile} title={t("To'liq profil")} aria-label={t("To'liq profil")} className={iconSmall}>
            <SquareArrowOutUpRight className="size-4" strokeWidth={1.75} />
          </Link>
          <button ref={closeRef} type="button" onClick={onClose} title={t("Yopish")} aria-label={t("Yopish")} className={`${iconBase} size-8`}>
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {canPay && (
            <button
              type="button"
              onClick={onPay}
              // Kassalar ro'yxati oldindan — bosilganda oyna kutmasdan ochilsin.
              onPointerEnter={prefetchStudentPayment}
              onFocus={prefetchStudentPayment}
              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-v2-md bg-v2-brand px-3 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Wallet className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{t("To'lov qabul qilish")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSms}
            disabled={!row.phone}
            title={row.phone ? undefined : t("Telefon raqam yo'q")}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-v2-md border border-v2-border-strong bg-v2-surface px-3 text-v2-body font-medium text-v2-text transition-colors hover:bg-v2-surface-2 disabled:cursor-not-allowed disabled:opacity-50 ${canPay ? "" : "flex-1"}`}
          >
            <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden />
            SMS
          </button>
          {phone && (
            <a href={`tel:${phone.tel}`} title={t("Qo'ng'iroq qilish")} aria-label={t("Qo'ng'iroq qilish")} className={iconBtn}>
              <Phone className="size-4" strokeWidth={1.75} />
            </a>
          )}
          <ActionMenu items={menu} label={t("Qo'shimcha amallar")} width={220}>
            {(trigger) => (
              <button type="button" {...trigger} title={t("Qo'shimcha amallar")} aria-label={t("Qo'shimcha amallar")} className={iconBtn}>
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </ActionMenu>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Balans | Tanga */}
        <div className="grid grid-cols-2 divide-x divide-v2-border rounded-v2-lg border border-v2-border">
          <div className="px-4 py-3">
            <div className="text-v2-caption text-v2-text-2">{t("Balans")}</div>
            <div className={`mt-0.5 text-v2-section tabular-nums ${row.balance < 0 ? "text-v2-danger" : "text-v2-text"}`}>
              {fmtNum(row.balance)} {t("so'm")}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-v2-caption text-v2-text-2">{t("Tanga")}</div>
            <div className="mt-0.5 text-v2-section tabular-nums text-v2-text">{fmtNum(row.coin)}</div>
          </div>
        </div>

        {/* Ma'lumotlar */}
        <section>
          <h3 className={section}>{t("Ma'lumotlar")}</h3>
          <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-2.5 text-v2-small">
            <dt className="text-v2-text-2">{t("Telefon")}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-medium tabular-nums">
              {phone ? (
                <>
                  <span className="truncate">{phone.show}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(phone.copy);
                      showSuccess(t("Nusxa olindi"));
                    }}
                    title={t("Nusxa olish")}
                    aria-label={t("Nusxa olish")}
                    className="inline-flex size-6 items-center justify-center rounded-v2-sm text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text"
                  >
                    <Copy className="size-3.5" strokeWidth={1.75} />
                  </button>
                </>
              ) : (
                <span className="text-v2-text-3">—</span>
              )}
            </dd>
            <dt className="text-v2-text-2">{t("Filial")}</dt>
            <dd className="font-medium">{branchName || <span className="text-v2-text-3">—</span>}</dd>
            <dt className="text-v2-text-2">{t("Manba")}</dt>
            <dd className="font-medium">{row.source ? t(row.source) : <span className="text-v2-text-3">—</span>}</dd>
            <dt className="text-v2-text-2">{t("Guruhga qo'shilgan")}</dt>
            <dd className="font-medium tabular-nums">{ddmmyyyy(firstJoined) || <span className="text-v2-text-3">—</span>}</dd>
          </dl>
        </section>

        {/* Guruh */}
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-v2-small font-semibold text-v2-text">{t("Guruh")}</h3>
            <button type="button" onClick={onAddToGroup} className="rounded-v2-sm text-v2-small font-medium text-v2-brand-text hover:underline underline-offset-2">
              {t("Guruhga qo'shish")}
            </button>
          </div>
          {myGroups.length === 0 ? (
            <div className="rounded-v2-lg border border-dashed border-v2-border-strong px-4 py-3 text-v2-small text-v2-text-2">{t("Hali guruhga qo'shilmagan")}</div>
          ) : (
            <div className="space-y-2">
              {myGroups.map((g) => {
                const gt = GROUP_TONE[g.status];
                const meta1 = [g.teacher, roomLabel(g.room)].filter(Boolean).join(" · ");
                const meta2 = [g.day, timeLabel(g.time)].filter(Boolean).join(" · ");
                const body = (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold text-v2-text">{g.course || t("Guruh")}</span>
                      {gt && (
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-v2-full px-2 py-0.5 text-v2-caption ${gt.badge}`}>
                          <span className={`size-1.5 rounded-full ${gt.dot}`} aria-hidden />
                          {t(gt.label)}
                        </span>
                      )}
                    </div>
                    {meta1 && <div className="mt-1 truncate text-v2-small text-v2-text-2">{meta1}</div>}
                    {meta2 && <div className="truncate text-v2-small text-v2-text-2">{meta2}</div>}
                  </>
                );
                const cls = "block rounded-v2-lg border border-v2-border p-3 text-v2-body transition-colors";
                return canGroups ? (
                  <Link key={g.id} href={`/groups/${g.id}`} title={`${g.course} · ${g.name}`} className={`${cls} hover:border-v2-border-strong hover:bg-v2-hover`}>
                    {body}
                  </Link>
                ) : (
                  <div key={g.id} className={cls}>{body}</div>
                );
              })}
            </div>
          )}
        </section>

        {/* To'lovlar */}
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-v2-small font-semibold text-v2-text">{t("To'lovlar")}</h3>
            {payments.total > payments.list.length && (
              <Link href={`${base}&tab=tranzaksiya`} className="text-v2-small font-medium text-v2-brand-text hover:underline underline-offset-2">
                {t("Hammasi ({n})", { n: payments.total })}
              </Link>
            )}
          </div>
          {payments.loading ? (
            <div className="space-y-2" aria-hidden>
              <div className="h-12 rounded-v2-lg bg-v2-skeleton" />
              <div className="h-12 rounded-v2-lg bg-v2-skeleton" />
            </div>
          ) : payments.list.length === 0 ? (
            <div className="flex items-center gap-3 rounded-v2-lg bg-v2-surface-2 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
                <Receipt className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block text-v2-small font-semibold text-v2-text">{t("Hali to'lov qilinmagan")}</span>
                <span className="block text-v2-caption text-v2-text-2">{t("Birinchi to'lov shu yerda ko'rinadi")}</span>
              </span>
            </div>
          ) : (
            <ul className="divide-y divide-v2-border rounded-v2-lg border border-v2-border">
              {payments.list.map((p) => {
                const pm = /^(\d{4})-(\d{2})/.exec(p.periodMonth || "");
                const forMonth = pm ? months[Number(pm[2]) - 1] : "";
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-small font-medium text-v2-text">{p.txName ? t(p.txName) : t("To'lov")}</div>
                      <div className="truncate text-v2-caption text-v2-text-3">
                        {[ddmmyyyy(p.date), p.paymentType ? t(p.paymentType) : "", forMonth ? t("{month} uchun", { month: forMonth }) : ""].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-v2-small font-semibold tabular-nums text-v2-success">+{fmtNum(p.amount)} {t("so'm")}</div>
                      {p.status === "waiting" && <div className="text-v2-caption text-v2-warning">{t("Kutilmoqda")}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tarix */}
        <section>
          <h3 className={section}>{t("Tarix")}</h3>
          {history.length === 0 ? (
            <div className="text-v2-small text-v2-text-3">—</div>
          ) : (
            <ol className="space-y-3">
              {history.map((h, i) => (
                <li key={h.key} className="flex gap-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${i === 0 ? "bg-v2-brand" : "bg-v2-border-strong"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-v2-small font-medium text-v2-text">{h.title}</span>
                    <span className="block text-v2-caption tabular-nums text-v2-text-3">{h.when}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}
