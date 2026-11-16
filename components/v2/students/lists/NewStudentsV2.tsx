"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, MessageSquare, MoreHorizontal, Plus, UserRound, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import SmsModal from "@/components/orders/SmsModal";
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
import { firstMonthTarget, isNewStudent, type StudentListRow } from "@/lib/studentListsTypes";
import {
  B,
  CabinetBadge,
  EmptyRow,
  GroupCell,
  NoticeBar,
  PageHead,
  PageShell,
  PersonCell,
  SearchBox,
  SimplePager,
  SkeletonRows,
  SortHead,
  SummaryLine,
  TableCard,
  TH,
  dmy,
  downloadCsv,
  fmtNum,
  fmtPhone,
  matchQuery,
} from "./listKit";
import { useStudentLists } from "./useStudentLists";
import { toStudentRow } from "./rowAdapters";

// YANGI VERSIYA — O'QUVCHILAR → YANGI O'QUVCHILAR (30-qism, rasm «Yangi o'quvchilar», yorug'/qorong'i).
//
// Rasm: «guruhga qo'shilgan, birinchi oy to'lovi hali to'liq emas»; «Birinchi darsda «Keldi»
// bosilgan o'quvchi shu yerga tushadi. Birinchi oy to'liq to'langach avtomatik «Aktiv»ga o'tadi.»
// Bazada «Yangi» holati yo'q — tanlov qoidasi lib/studentListsTypes.ts → isNewStudent (SAVOLLAR 410).
// Eski sahifa (Yangi holatidagi LIDLAR ro'yxati) — `?classic=1`.

type ColKey = "student" | "group" | "joined" | "firstPay" | "cabinet" | "source";
type SortKey = "joined" | "name" | "firstPay";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "student", label: "O'quvchi", on: true, locked: true },
  { key: "group", label: "Guruh", on: true },
  { key: "joined", label: "Qo'shilgan", on: true },
  { key: "firstPay", label: "Birinchi oy to'lovi", on: true },
  { key: "cabinet", label: "Ota-ona kabineti", on: true },
  { key: "source", label: "Manba", on: true },
];

const PAY_FILTERS = [
  { value: "none", label: "To'lov qilmagan" },
  { value: "partial", label: "Qisman to'lagan" },
];

export default function NewStudentsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const create = useCreate();
  const { rows: all, asOf, loading, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:new-students:columns:1", COLUMNS);

  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [group, setGroup] = useState("");
  const [pay, setPay] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "joined", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [payFor, setPayFor] = useState<StudentListRow | null>(null);
  const [smsFor, setSmsFor] = useState<StudentListRow | null>(null);

  const rows = useMemo(() => all.filter((r) => isNewStudent(r, asOf)), [all, asOf]);
  const courseOptions = useMemo(() => [...new Set(rows.flatMap((r) => r.groups.map((g) => g.course)).filter(Boolean))].sort().map((v) => ({ value: v, label: v })), [rows]);
  const groupOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) for (const g of r.groups) m.set(g.id, [g.name, g.course, g.teacher].filter(Boolean).join(" · "));
    return [...m.entries()].map(([v, label]) => ({ value: String(v), label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (!matchQuery(q, r.name, r.phone)) return false;
      if (course && !r.groups.some((g) => g.course === course)) return false;
      if (group && !r.groups.some((g) => String(g.id) === group)) return false;
      if (pay === "none" && r.paid > 0) return false;
      if (pay === "partial" && !(r.paid > 0)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c =
        sort.key === "name"
          ? a.name.localeCompare(b.name, "uz")
          : sort.key === "firstPay"
            ? a.paid - b.paid
            : (a.firstJoinedAt ?? "").localeCompare(b.firstJoinedAt ?? "");
      return c !== 0 ? c * sign : b.id - a.id;
    });
  }, [rows, q, course, group, pay, sort]);

  const waiting = filtered.reduce((s, r) => s + Math.max(0, (firstMonthTarget(r) ?? 0) - r.paid), 0);
  const inCabinet = filtered.filter((r) => r.cabinet === "in").length;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const cols = columns.shown.map((c) => c.key);
  const colCount = cols.length + 3;

  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "firstPay" ? "asc" : "asc" }));
    setPage(1);
  };
  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  function exportCsv() {
    const list = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    downloadCsv(
      "yangi-oquvchilar.csv",
      ["ID", "O'quvchi", "Telefon", "Guruh", "O'qituvchi", "Qo'shilgan", "To'langan", "Birinchi oy", "Ota-ona kabineti", "Manba"],
      list.map((r) => [
        r.id,
        r.name,
        fmtPhone(r.phone),
        r.groups.map((g) => [g.course, g.level].filter(Boolean).join(" · ")).join("; "),
        r.groups.map((g) => g.teacher).join("; "),
        dmy(r.firstJoinedAt),
        r.paid,
        firstMonthTarget(r) ?? "",
        r.cabinet === "in" ? "Kirgan" : r.cabinet === "invited" ? "Taklif ketdi" : "Kirmagan",
        r.source,
      ]),
    );
  }

  function rowMenu(r: StudentListRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: r.name },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.id}` },
      { key: "pay", label: t("To'lov qabul qilish"), icon: Wallet, onSelect: () => setPayFor(r) },
      { key: "sms", label: t("SMS yuborish"), icon: MessageSquare, disabled: !r.phone, onSelect: () => setSmsFor(r) },
    ];
  }

  function cell(r: StudentListRow, k: ColKey) {
    switch (k) {
      case "student":
        return null;
      case "group":
        return <GroupCell groups={r.groups} />;
      case "joined":
        return (
          <div className="whitespace-nowrap">
            <span className="tabular-nums text-v2-text">{dmy(r.firstJoinedAt) || "—"}</span>
            <span className="block text-v2-small text-v2-text-3">{r.fromFirstLesson ? t("birinchi darsdan") : t("to'g'ridan")}</span>
          </div>
        );
      case "firstPay": {
        const target = firstMonthTarget(r);
        const pct = target ? Math.min(100, Math.round((r.paid / target) * 100)) : 0;
        return (
          <div className="w-[150px]">
            <div className="flex items-baseline justify-between gap-2 tabular-nums">
              <span className="font-semibold text-v2-text">{fmtNum(r.paid)}</span>
              <span className="text-v2-small text-v2-text-3">/ {target === null ? "—" : fmtNum(target)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-v2-full bg-v2-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-v2-full bg-v2-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      }
      case "cabinet":
        return <CabinetBadge row={r} />;
      case "source":
        return (
          <div className="min-w-[110px]">
            <span className="text-v2-text">{r.source ? t(r.source) : "—"}</span>
            {r.referredBy && <span className="block truncate text-v2-small text-v2-brand-text">{t("{name} orqali", { name: r.referredBy })}</span>}
          </div>
        );
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    student: null,
    group: t("Guruh"),
    joined: <SortHead label={t("Qo'shilgan")} k="joined" sort={sort} onSort={onSort} />,
    firstPay: <SortHead label={t("Birinchi oy to'lovi")} k="firstPay" sort={sort} onSort={onSort} />,
    cabinet: t("Ota-ona kabineti"),
    source: t("Manba"),
  };

  return (
    <PageShell>
      <PageHead
        title={t("Yangi o'quvchilar")}
        subtitle={[branchName, t("guruhga qo'shilgan, birinchi oy to'lovi hali to'liq emas")].filter(Boolean).join(" · ")}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtn}>
              <Download className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Export")}
            </button>
            <button type="button" onClick={() => create.open("student")} className={primaryBtn}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              {t("O'quvchi qo'shish")}
            </button>
          </>
        }
      />

      <NoticeBar
        action={
          <Link href="/first-lessons" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-v2-brand-text hover:underline">
            {t("Birinchi darsga yozilganlar")}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        }
      >
        {t("Birinchi darsda «Keldi» bosilgan o'quvchi shu yerga tushadi. Birinchi oy to'liq to'langach avtomatik «Aktiv»ga o'tadi.")}
      </NoticeBar>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ism yoki telefon")} />
        <V2Select variant="chip" label={t("Kurs")} value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={courseOptions} />
        <V2Select variant="chip" label={t("Guruh")} value={group} onChange={(v) => { setGroup(v); setPage(1); }} options={groupOptions} />
        <V2Select variant="chip" label={t("Birinchi to'lov")} value={pay} onChange={(v) => { setPay(v); setPage(1); }} options={PAY_FILTERS.map((o) => ({ ...o, label: t(o.label) }))} searchable={false} />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n"><B>{filtered.length}</B> {t("ta yangi o'quvchi")}</span>,
          <span key="w">{t("Birinchi to'lov kutilmoqda")} <B>{fmtNum(waiting)} {t("so'm")}</B></span>,
          <span key="c">{t("Ota-ona kabinetida")} <B>{inCabinet}</B> {t("tasi")}</span>,
          selected.size > 0 && (
            <span key="s" className="text-v2-brand-text">
              {t("{n} ta belgilandi", { n: selected.size })}
            </span>
          ),
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
            {cols.map((k) => (
              <th key={k} className={TH}>{head[k]}</th>
            ))}
            <th className={`${TH} w-px`}><span className="sr-only">{t("Amallar")}</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={colCount} />}
          {!loading && slice.length === 0 && (
            <EmptyRow
              cols={colCount}
              title={rows.length === 0 ? t("Hozircha yangi o'quvchi yo'q") : t("Mos o'quvchi topilmadi")}
              hint={rows.length === 0 ? t("Guruhga yangi qo'shilgan va birinchi oyini hali to'liq to'lamagan o'quvchilar shu yerda chiqadi.") : t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}
            />
          )}
          {!loading &&
            slice.map((r) => {
              const on = selected.has(r.id);
              return (
                <tr key={r.id} className={`group border-b border-v2-border last:border-b-0 ${on ? ROW_TINT.brand : ROW_TINT.hover}`}>
                  <td className="py-2.5 pl-4 pr-2"><V2Checkbox checked={on} onChange={(v) => toggle(r.id, v)} label={t("{name} — belgilash", { name: r.name })} /></td>
                  <td className="px-2.5 py-2.5"><PersonCell id={r.id} name={r.name} sub={fmtPhone(r.phone) || "—"} /></td>
                  {cols.map((k) => (
                    <td key={k} className="px-2.5 py-2.5 align-middle">{cell(r, k)}</td>
                  ))}
                  <td className="py-2.5 pl-1 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setPayFor(r)} className={`${secondaryBtn} h-8!`}>
                        {t("To'lov")}
                      </button>
                      <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.name })}>
                        {(trigger) => (
                          <button type="button" {...trigger} aria-label={t("{name} — amallar", { name: r.name })} className="inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 hover:bg-v2-surface-2 hover:text-v2-text">
                            <MoreHorizontal className="size-4" strokeWidth={1.75} />
                          </button>
                        )}
                      </ActionMenu>
                    </div>
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
    </PageShell>
  );
}
