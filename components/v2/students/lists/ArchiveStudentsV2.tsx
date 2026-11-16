"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, MessageSquare, MoreHorizontal, RotateCcw, UserRound } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch } from "@/components/shared/BranchContext";
import { useToast } from "@/components/ui/Toast";
import SmsModal from "@/components/orders/SmsModal";
import StudentStatusModal from "@/components/students/StudentStatusModal";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import ColumnsControl from "@/components/v2/ui/ColumnsControl";
import V2Checkbox from "@/components/v2/ui/V2Checkbox";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn } from "@/components/v2/ui/buttons";
import { useColumnPrefs, type ColumnDef } from "@/components/v2/ui/columnPrefs";
import { ROW_TINT } from "@/components/v2/ui/table";
import { daysBetween, monthOf, type StudentListRow } from "@/lib/studentListsTypes";
import {
  B,
  EmptyRow,
  GroupCell,
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
  monthRange,
  useStudentLists,
} from "./listKit";

// YANGI VERSIYA — O'QUVCHILAR → ARXIV O'QUVCHILAR (30-qism, rasm «Arxiv o'quvchilar», yorug'/qorong'i).
//
// Holati «Arxiv» bo'lganlar. Arxivlangan kun — `statusChangedAt`; sabab — `statusReason` (birinchi
// « — » gacha sabab, qolgani izoh: «Vaqt to'g'ri kelmadi — maktab smenasi o'zgardi»). Oxirgi guruh —
// yopilgan oxirgi a'zolik; «O'qidi» — birinchi a'zolikdan arxivgacha. «Qaytarish» — holat oynasi
// (Aktiv), keyin guruhga qo'shiladi. Eski sahifa — `?classic=1`.

type ColKey = "student" | "lastGroup" | "archivedAt" | "studied" | "reason" | "balance";
type SortKey = "name" | "archivedAt" | "balance";
type Period = "month" | "2m" | "3m" | "year" | "all";

const COLUMNS: ColumnDef<ColKey>[] = [
  { key: "student", label: "O'quvchi", on: true, locked: true },
  { key: "lastGroup", label: "Oxirgi guruh", on: true },
  { key: "archivedAt", label: "Arxivlangan", on: true },
  { key: "studied", label: "O'qidi", on: true },
  { key: "reason", label: "Sabab", on: true },
  { key: "balance", label: "Balans", on: true, align: "right" },
];

const SLACK = 1000;

/** «Vaqt to'g'ri kelmadi — maktab smenasi o'zgardi» → [sabab, izoh]. */
function splitReason(raw: string): [string, string] {
  const s = raw.trim();
  const m = /\s[—–-]\s/.exec(s);
  if (!m) return [s, ""];
  return [s.slice(0, m.index).trim(), s.slice(m.index + m[0].length).trim()];
}

/** "YYYY-MM" dan n oy oldingi oy. */
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function ArchiveStudentsV2() {
  const { t } = useT();
  const branch = useBranch();
  const { showSuccess, showError } = useToast();
  const { rows: all, asOf, loading, reload } = useStudentLists();
  const columns = useColumnPrefs("v2:archive-students:columns:1", COLUMNS);

  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("2m");
  const [course, setCourse] = useState("");
  const [reason, setReason] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "archivedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [backFor, setBackFor] = useState<StudentListRow | null>(null);
  const [smsFor, setSmsFor] = useState<StudentListRow | null>(null);

  const month = asOf ? monthOf(asOf) : "";
  const fromMonth = !month ? "" : period === "month" ? month : period === "2m" ? shiftMonth(month, -1) : period === "3m" ? shiftMonth(month, -2) : period === "year" ? `${month.slice(0, 4)}-01` : "";
  const periodLabel = fromMonth ? monthRange(fromMonth, month) : t("hammasi");

  const archived = useMemo(() => all.filter((r) => r.status === "Arxiv"), [all]);
  const inPeriod = useMemo(
    () => archived.filter((r) => !fromMonth || (r.statusChangedAt && r.statusChangedAt.slice(0, 7) >= fromMonth)),
    [archived, fromMonth],
  );
  const courseOptions = useMemo(
    () => [...new Set(archived.map((r) => (r.lastGroup ?? r.groups[0])?.course ?? "").filter(Boolean))].sort().map((v) => ({ value: v, label: v })),
    [archived],
  );
  const reasonChips = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of inPeriod) {
      const [main] = splitReason(r.statusReason);
      if (main) m.set(main, (m.get(main) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [inPeriod]);

  const filtered = useMemo(() => {
    const list = inPeriod.filter((r) => {
      if (!matchQuery(q, r.name, r.phone)) return false;
      const g = r.lastGroup ?? r.groups[0];
      if (course && g?.course !== course) return false;
      if (reason && splitReason(r.statusReason)[0] !== reason) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const c =
        sort.key === "name" ? a.name.localeCompare(b.name, "uz") : sort.key === "balance" ? b.debt - a.debt : a.statusChangedAt.localeCompare(b.statusChangedAt);
      return c !== 0 ? c * sign : b.id - a.id;
    });
  }, [inPeriod, q, course, reason, sort]);

  const owing = filtered.filter((r) => r.debt > SLACK);
  const owingSum = owing.reduce((s, r) => s + r.debt, 0);
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = slice.map((r) => r.id);
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const branchName = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const colCount = columns.shown.length + 3;

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

  function studied(r: StudentListRow): string {
    const end = r.statusChangedAt || r.lastGroup?.leftAt || "";
    if (!r.firstJoinedAt || !end) return "—";
    const days = Math.max(0, daysBetween(r.firstJoinedAt, end));
    if (days < 28) return t("{n} hafta", { n: Math.max(1, Math.round(days / 7)) });
    return t("{n} oy", { n: Math.max(1, Math.round(days / 30.4)) });
  }

  function cell(r: StudentListRow, k: ColKey) {
    switch (k) {
      case "student":
        return null;
      case "lastGroup": {
        const g = r.lastGroup ?? r.groups[0];
        return g ? <GroupCell groups={[g]} /> : <span className="text-v2-text-3">—</span>;
      }
      case "archivedAt":
        return <span className="whitespace-nowrap tabular-nums text-v2-text">{dmy(r.statusChangedAt) || "—"}</span>;
      case "studied":
        return <span className="whitespace-nowrap text-v2-text">{studied(r)}</span>;
      case "reason": {
        const [main, note] = splitReason(r.statusReason);
        return main ? (
          <div className="min-w-[150px] max-w-[240px]">
            <span className="block truncate text-v2-text">{main}</span>
            {note && <span className="block truncate text-v2-small text-v2-text-3">{note}</span>}
          </div>
        ) : (
          <span className="text-v2-text-3">—</span>
        );
      }
      case "balance": {
        const b = Math.abs(r.debt) < SLACK ? 0 : -r.debt;
        return (
          <span className={`whitespace-nowrap tabular-nums ${b < 0 ? "font-semibold text-v2-danger" : b > 0 ? "font-semibold text-v2-success" : "text-v2-text"}`}>
            {b > 0 ? "+" : ""}
            {fmtNum(b)} {t("so'm")}
          </span>
        );
      }
    }
  }

  const head: Record<ColKey, React.ReactNode> = {
    student: null,
    lastGroup: t("Oxirgi guruh"),
    archivedAt: <SortHead label={t("Arxivlangan")} k="archivedAt" sort={sort} onSort={onSort} />,
    studied: t("O'qidi"),
    reason: t("Sabab"),
    balance: <SortHead label={t("Balans")} k="balance" sort={sort} onSort={onSort} align="right" />,
  };

  function rowMenu(r: StudentListRow): ActionMenuEntry[] {
    return [
      { key: "h", heading: r.name },
      { key: "open", label: t("Profilni ochish"), icon: UserRound, href: `/student-edit/${r.id}` },
      { key: "back", label: t("Qaytarish"), icon: RotateCcw, onSelect: () => setBackFor(r) },
      { key: "sms", label: t("SMS yuborish"), icon: MessageSquare, disabled: !r.phone, onSelect: () => setSmsFor(r) },
    ];
  }

  function exportCsv() {
    const list = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    downloadCsv(
      "arxiv-oquvchilar.csv",
      ["ID", "O'quvchi", "Telefon", "Oxirgi guruh", "O'qituvchi", "Arxivlangan", "O'qidi", "Sabab", "Balans"],
      list.map((r) => {
        const g = r.lastGroup ?? r.groups[0];
        return [r.id, r.name, fmtPhone(r.phone), g ? [g.course, g.level].filter(Boolean).join(" · ") : "", g?.teacher ?? "", dmy(r.statusChangedAt), studied(r), r.statusReason, -r.debt];
      }),
    );
  }

  return (
    <PageShell>
      <PageHead
        title={t("Arxiv o'quvchilar")}
        subtitle={[branchName, t("o'qishni to'xtatganlar — to'lovlar, davomat va natijalar saqlanadi")].filter(Boolean).join(" · ")}
        actions={
          <button type="button" onClick={exportCsv} className={secondaryBtn}>
            <Download className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Export")}
          </button>
        }
      />

      {/* Ketish sabablari — tanlangan davr bo'yicha; chip bosilsa jadval shu sabab bilan toraytiriladi. */}
      <div className="rounded-v2-lg border border-v2-border bg-v2-surface-2 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-v2-small text-v2-text-2">{t("Ketish sabablari")} · {periodLabel}</span>
          <Link href="/reports-leave-reasons" className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-brand-text hover:underline">
            {t("Hisobotda ko'rish")}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
        {reasonChips.length === 0 ? (
          <p className="text-v2-small text-v2-text-3">{t("Bu davrda arxivlangan o'quvchi yo'q.")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {reasonChips.map(([name, n]) => {
              const on = reason === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setReason(on ? "" : name); setPage(1); }}
                  className={`inline-flex h-7 items-center gap-2 rounded-v2-full border px-3 text-v2-small transition-colors ${
                    on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border bg-v2-surface text-v2-text hover:border-v2-border-strong"
                  }`}
                >
                  {name}
                  <b className="font-semibold tabular-nums">{n}</b>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Ism yoki telefon")} />
        <V2Select
          variant="chip"
          label={t("Arxivlangan")}
          value={period === "all" ? "" : period}
          onChange={(v) => { setPeriod((v || "all") as Period); setPage(1); }}
          searchable={false}
          options={[
            { value: "month", label: t("Shu oy") },
            { value: "2m", label: t("Oxirgi 2 oy") },
            { value: "3m", label: t("Oxirgi 3 oy") },
            { value: "year", label: t("Shu yil") },
          ]}
        />
        <V2Select variant="chip" label={t("Kurs")} value={course} onChange={(v) => { setCourse(v); setPage(1); }} options={courseOptions} />
        <div className="ml-auto">
          <ColumnsControl prefs={columns} />
        </div>
      </div>

      <SummaryLine
        items={[
          <span key="n"><B>{filtered.length}</B> {t("ta o'quvchi")}</span>,
          <span key="o">
            {t("Qarzi qolgan")} <B tone={owing.length ? "danger" : undefined}>{t("{n} ta", { n: owing.length })} · {fmtNum(owingSum)} {t("so'm")}</B>
          </span>,
          <span key="a">{t("Jami arxivda")} <B>{archived.length}</B></span>,
        ]}
      />

      <TableCard
        footer={
          <SimplePager
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
            note={t("«Qaytarish» — o'quvchini yana aktiv qiladi, tarix saqlanadi")}
          />
        }
      >
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
              title={archived.length === 0 ? t("Arxivda o'quvchi yo'q") : t("Mos o'quvchi topilmadi")}
              hint={archived.length === 0 ? undefined : t("Davr, sabab yoki qidiruvni o'zgartirib ko'ring.")}
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
                  <td className="py-2.5 pl-1 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setBackFor(r)} className={`${secondaryBtn} h-8! gap-1.5!`}>
                        <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
                        {t("Qaytarish")}
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

      {backFor && (
        <StudentStatusModal
          student={{ id: backFor.id, name: backFor.name, status: backFor.status, statusReason: backFor.statusReason }}
          onClose={() => setBackFor(null)}
          onSaved={() => {
            setBackFor(null);
            showSuccess(t("Holat saqlandi"));
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
