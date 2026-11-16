"use client";

import { useMemo, useState } from "react";
import { Download, MessageSquare, MoreHorizontal, UserCog, UserRound, Wallet } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import SmsModal from "@/components/orders/SmsModal";
import StudentStatusModal from "@/components/students/StudentStatusModal";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import { useCreate } from "@/components/v2/shell/CreateContext";
import { emitMoneyChanged } from "@/components/v2/shell/v2Events";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { isActiveStudent, monthOf, type StudentListRow } from "@/lib/studentListsTypes";
import {
  B,
  Badge,
  EmptyRow,
  GroupCell,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SegmentPills,
  SimplePager,
  SkeletonRows,
  SortHead,
  SummaryLine,
  TableCard,
  TH,
  dayMonth,
  dayMonthShort,
  dmy,
  downloadCsv,
  fmtNum,
  fmtPhone,
  matchQuery,
  monthName,
  monthRange,
} from "./listKit";
import { useStudentLists } from "./useStudentLists";
import { toStudentRow } from "./rowAdapters";

// YANGI VERSIYA — O'QUVCHILAR → AKTIV O'QUVCHILAR (30-qism, rasm «Aktiv o'quvchilar», yorug'/qorong'i).
//
// «To'lov qilib o'qiyotganlar»: holati Aktiv, guruhda o'qiyotgan va «Yangi» emas (birinchi oyini
// yopgan). Joriy oy ustuni — lib/studentLists.ts → monthState (Qarzdorlar hisobi bilan bitta qoida):
// To'langan / Qarzdor · oy(lar) / To'lov kuni · sana. Balans — to'langan − hisoblangan (bugungacha).
// Eski sahifa — `?classic=1`.

type Seg = "all" | "paid" | "debt" | "due";
type ColKey = "student" | "group" | "month" | "balance" | "lastPay" | "referred";
type SortKey = "name" | "balance" | "lastPay";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "student", label: "O'quvchi", on: true, locked: true },
  { key: "group", label: "Guruh", on: true },
  { key: "month", label: "Joriy oy", on: true },
  { key: "balance", label: "Balans", on: true, align: "right" },
  { key: "lastPay", label: "Oxirgi to'lov", on: true },
  { key: "referred", label: "Taklif qilgani", on: true },
];

const SLACK = 1000;
/** Balans: |qarz| yaxlitlash qoldig'idan kichik — 0. */
const balanceOf = (r: StudentListRow) => (Math.abs(r.debt) < SLACK ? 0 : -r.debt);

export default function ActiveStudentsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const create = useCreate();
  const { rows: all, asOf, loading, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:active-students:columns:1", COLUMNS);

  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [group, setGroup] = useState("");
  const [teacher, setTeacher] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [payFor, setPayFor] = useState<StudentListRow | null>(null);
  const [smsFor, setSmsFor] = useState<StudentListRow | null>(null);
  const [statusFor, setStatusFor] = useState<StudentListRow | null>(null);

  const month = asOf ? monthOf(asOf) : "";
  const monthLabel = month ? monthName(month) : t("Joriy oy");
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const rows = useMemo(() => all.filter((r) => isActiveStudent(r, asOf)), [all, asOf]);

  const options = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort().map((v) => ({ value: v, label: v }));
    const gm = new Map<number, string>();
    for (const r of rows) for (const g of r.groups) gm.set(g.id, [g.name, g.course, g.teacher].filter(Boolean).join(" · "));
    return {
      course: uniq(rows.flatMap((r) => r.groups.map((g) => g.course))),
      teacher: uniq(rows.flatMap((r) => r.groups.map((g) => g.teacher))),
      group: [...gm.entries()].map(([v, label]) => ({ value: String(v), label })),
    };
  }, [rows]);

  const base = useMemo(
    () =>
      rows.filter((r) => {
        if (!matchQuery(q, r.name, r.phone, r.id)) return false;
        if (course && !r.groups.some((g) => g.course === course)) return false;
        if (group && !r.groups.some((g) => String(g.id) === group)) return false;
        if (teacher && !r.groups.some((g) => g.teacher === teacher)) return false;
        return true;
      }),
    [rows, q, course, group, teacher],
  );
  const counts = useMemo(
    () => ({
      all: base.length,
      paid: base.filter((r) => r.monthState === "paid").length,
      debt: base.filter((r) => r.monthState === "debt").length,
      due: base.filter((r) => r.monthState === "due").length,
    }),
    [base],
  );
  const filtered = useMemo(() => {
    const list = seg === "all" ? base : base.filter((r) => r.monthState === seg);
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c =
        sort.key === "balance"
          ? balanceOf(a) - balanceOf(b)
          : sort.key === "lastPay"
            ? (a.lastPaymentDate ?? "").localeCompare(b.lastPaymentDate ?? "")
            : a.name.localeCompare(b.name, "uz");
      return c !== 0 ? c * sign : b.id - a.id;
    });
  }, [base, seg, sort]);

  const debt = filtered.reduce((s, r) => s + Math.min(0, balanceOf(r)), 0);
  const credit = filtered.reduce((s, r) => s + Math.max(0, balanceOf(r)), 0);
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const cols = columns.shown.map((c) => c.key);
  const colCount = cols.length + 3;

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "name" ? "asc" : "desc" }));
    setPage(1);
  };
  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function monthBadge(r: StudentListRow) {
    if (r.monthState === "paid") return <Badge tone="success">{t("To'langan")}</Badge>;
    if (r.monthState === "due") return <Badge tone="neutral">{`${t("To'lov kuni")} · ${dayMonthShort(r.dueDate)}`}</Badge>;
    if (r.monthState === "debt") {
      const u = r.unpaid;
      const label = !u ? monthLabel : u.count > 1 ? t("{n} oy", { n: u.count }) : monthName(u.from);
      return <Badge tone="danger" title={u ? monthRange(u.from, u.to) : undefined}>{`${t("Qarzdor")} · ${label}`}</Badge>;
    }
    return <span className="text-v2-text-3" title={t("Guruh narxi kiritilmagan yoki hisoblab bo'lmaydi")}>—</span>;
  }

  function cell(r: StudentListRow, k: ColKey) {
    switch (k) {
      case "student":
        return null;
      case "group":
        return <GroupCell groups={r.groups} />;
      case "month":
        return monthBadge(r);
      case "balance": {
        const b = balanceOf(r);
        return (
          <span className={`whitespace-nowrap tabular-nums ${b < 0 ? "font-semibold text-v2-danger" : b > 0 ? "font-semibold text-v2-success" : "text-v2-text"}`}>
            {b > 0 ? "+" : ""}
            {fmtNum(b)} {t("so'm")}
          </span>
        );
      }
      case "lastPay":
        return r.lastPaymentDate ? <span className="tabular-nums text-v2-text">{dmy(r.lastPaymentDate)}</span> : <span className="text-v2-text-3">—</span>;
      case "referred":
        return r.referred > 0 ? (
          <div className="whitespace-nowrap">
            <span className="font-semibold text-v2-text">{t("{n} kishi", { n: r.referred })}</span>
            <span className="block text-v2-small text-v2-text-3">{t("{n} tasi to'ladi", { n: r.referredPaid })}</span>
          </div>
        ) : (
          <span className="text-v2-text-3">—</span>
        );
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    student: null,
    group: t("Guruh"),
    month: monthTitle,
    balance: <SortHead label={t("Balans")} k="balance" sort={sort} onSort={onSort} align="right" />,
    lastPay: <SortHead label={t("Oxirgi to'lov")} k="lastPay" sort={sort} onSort={onSort} />,
    referred: t("Taklif qilgani"),
  };

  function rowMenu(r: StudentListRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: r.name },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.id}` },
      { key: "pay", label: t("To'lov qabul qilish"), icon: Wallet, onSelect: () => setPayFor(r) },
      { key: "sms", label: t("SMS yuborish"), icon: MessageSquare, disabled: !r.phone, onSelect: () => setSmsFor(r) },
      { key: "d", divider: true },
      { key: "status", label: t("Holatni o'zgartirish"), icon: UserCog, onSelect: () => setStatusFor(r) },
    ];
  }

  function exportCsv() {
    const list = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    downloadCsv(
      "aktiv-oquvchilar.csv",
      ["ID", "O'quvchi", "Telefon", "Guruh", "O'qituvchi", monthTitle, "Balans", "Oxirgi to'lov", "Taklif qilgani"],
      list.map((r) => [
        r.id,
        r.name,
        fmtPhone(r.phone),
        r.groups.map((g) => [g.course, g.level].filter(Boolean).join(" · ")).join("; "),
        r.groups.map((g) => g.teacher).join("; "),
        r.monthState === "paid" ? "To'langan" : r.monthState === "due" ? `To'lov kuni ${dmy(r.dueDate)}` : r.monthState === "debt" ? "Qarzdor" : "",
        balanceOf(r),
        dmy(r.lastPaymentDate),
        r.referred,
      ]),
    );
  }

  return (
    <PageShell>
      <PageHead
        title={t("Aktiv o'quvchilar")}
        subtitle={[branchName, t("to'lov qilib o'qiyotganlar"), asOf ? t("{date} holatiga", { date: dayMonth(asOf) }) : ""].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button type="button" onClick={() => create.open("payment")} className={primaryBtn}>
              <Wallet className="size-4" strokeWidth={2} aria-hidden />
              {t("To'lov qabul qilish")}
            </button>
          </>
        }
      />

      <SegmentPills
        value={seg}
        onChange={(k) => { setSeg(k); setPage(1); }}
        items={[
          { key: "all", label: t("Hammasi"), count: counts.all },
          { key: "paid", label: t("{month} to'langan", { month: monthTitle }), count: counts.paid },
          { key: "debt", label: t("Qarzdor"), count: counts.debt },
          { key: "due", label: t("To'lov kuni kelmagan"), count: counts.due },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ism, telefon yoki ID")} />
        <V2Select variant="chip" label={t("Kurs")} value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={options.course} />
        <V2Select variant="chip" label={t("Guruh")} value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={options.group} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacher} onChange={(v) => { setTeacher(v); setPage(1); }} options={options.teacher} />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n"><B>{filtered.length}</B> {t("ta aktiv o'quvchi")}</span>,
          <span key="d">{t("Qarzdorlik")} <B tone={debt < 0 ? "danger" : undefined}>{fmtNum(Math.abs(debt))} {t("so'm")}</B></span>,
          <span key="c">{t("Haqdorlik")} <B>{fmtNum(credit)} {t("so'm")}</B></span>,
          selected.size > 0 && <span key="s" className="text-v2-brand-text">{t("{n} ta belgilandi", { n: selected.size })}</span>,
        ]}
      />

      <TableCard footer={<SimplePager total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />}>
        <thead>
          <tr>
            <th className={`${TH} w-10 pl-4 pr-2`}>
              <V2Checkbox
                checked={pageIds.length > 0 && pageSelected === pageIds.length}
                indeterminate={pageSelected > 0 && pageSelected < pageIds.length}
                onChange={(on) => pageIds.forEach((id) => toggle(id, on))}
                label={t("Sahifadagilarni belgilash")}
              />
            </th>
            <th className={TH}><SortHead label={t("O'quvchi")} k="name" sort={sort} onSort={onSort} /></th>
            {columns.shown.map((c) => (
              <th key={c.key} className={`${TH} ${c.align === "right" ? "text-right" : ""}`}>{head[c.key]}</th>
            ))}
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={colCount} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={colCount}
              title={rows.length === 0 ? t("Hozircha aktiv o'quvchi yo'q") : t("Mos o'quvchi topilmadi")}
              hint={rows.length === 0 ? t("Guruhda o'qiyotgan va birinchi oyini yopgan o'quvchilar shu yerda chiqadi.") : t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}
            />
          )}
          {!loading &&
            slice.map((r) => {
              const on = selected.has(r.id);
              return (
                <tr key={r.id} className={`group border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(r.id, v)} label={t("{name} — belgilash", { name: r.name })} /></td>
                  <td className="px-2.5 py-2.5"><PersonCell id={r.id} name={r.name} sub={fmtPhone(r.phone) || "—"} /></td>
                  {columns.shown.map((c) => (
                    <td key={c.key} className={`px-2.5 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{cell(r, c.key)}</td>
                  ))}
                  <td className="py-2.5 pl-1 pr-3 text-right">
                    <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.name })}>
                      {(trigger, open) => (
                        <button
                          type="button"
                          {...trigger}
                          aria-label={t("{name} — amallar", { name: r.name })}
                          className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text ${open ? "bg-v2-surface-2" : ""}`}
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
      </TableCard>

      {payFor && (
        <StudentPaymentModalV2
          student={toStudentRow(payFor)}
          initialGroupId={payFor.groups[0]?.id ?? null}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            emitMoneyChanged();
            void reload();
          }}
        />
      )}
      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) showError(t("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)"));
            else showSuccess(t("SMS yuborildi"));
            setSmsFor(null);
          }}
          onError={showError}
        />
      )}
      {statusFor && (
        <StudentStatusModal
          student={{ id: statusFor.id, name: statusFor.name, status: statusFor.status, statusReason: statusFor.statusReason }}
          onClose={() => setStatusFor(null)}
          onSaved={() => {
            setStatusFor(null);
            void reload();
          }}
        />
      )}
    </PageShell>
  );
}
