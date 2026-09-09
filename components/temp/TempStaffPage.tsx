"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Search, Send, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
import EmployeeToggle from "@/components/employees/EmployeeToggle";
import { EMP_LEAVE_REASONS, ROLE_LABELS } from "@/constants/employees";
import type { TempStaffRow } from "@/app/api/temp-staff/route";

// "Vaqtinchalik tugma" (sidebar → Sozlamalardan keyin, faqat admin).
//
// VAQTINCHA turadigan bo'lim — nima uchun kerakligi
// app/(app)/vaqtinchalik/page.tsx da yozilgan. Butun modul ATAYLAB
// o'z-o'ziga yetarli: sahifa + shu komponent + /api/temp-staff. Kerak
// bo'lmay qolganda shu uchtasini va constants/sidebar.js dagi bir bandni
// o'chirish kifoya, boshqa hech qayerda izi qolmaydi.
//
// RO'YXAT KESILMAYDI: to'rtala filial xodimi bitta jadvalda. Qolgan
// ekranlar joriy filial bo'yicha kesiladi (lib/employeeBranches.ts) — bu
// yerdagi farq ataylab va sabab route izohida.

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const labelCls = "block text-[13px] font-medium mb-1.5";

type Branch = { id: number; name: string };
type ListResult =
  | { employees: TempStaffRow[]; branches: Branch[]; maxBatch: number }
  | { error: string };
/** /api/temp-staff/invite qaytaradigan qator natijasi. */
type InviteResult = { id: number; name: string; ok: boolean; error?: string };

/**
 * Ro'yxatni o'qiydi va SHUNCHAKI qaytaradi — holatga o'zi yozmaydi.
 *
 * Ataylab: effekt ichida to'g'ridan-to'g'ri setState chaqirish kaskadli
 * render beradi (react-hooks/set-state-in-effect), shu bois yozish
 * chaqiruvchida — effektning `.then()` ida yoki hodisa ishlovchisida.
 */
async function fetchList(): Promise<ListResult> {
  try {
    const res = await fetch("/api/temp-staff");
    const data = await res.json();
    if (!data.ok) return { error: data.error || "Ro'yxat yuklanmadi" };
    return {
      employees: data.employees as TempStaffRow[],
      branches: data.branches as Branch[],
      maxBatch: Number(data.maxBatch) || 25,
    };
  } catch {
    return { error: "Serverga ulanib bo'lmadi" };
  }
}

/**
 * Hisob holati ustuni — "nega raqam band?" va "kimga SMS kerak?" degan
 * ikkala savolga javob. Rang uchta holatni bir qarashda ajratadi:
 *   YASHIL  — faollashgan, parol qo'yilgan (SMS kerak emas)
 *   QIZIL   — hisob umuman yo'q (raqam bo'sh, taklif yuborilmagan)
 *   SARIQ   — taklif yuborilgan, lekin hali faollashtirilmagan
 */
function AccountBadge({ status }: { status: string | null }) {
  const [label, cls] =
    status === null
      ? ["Hisob yo'q", "bg-rose-500/10 text-rose-600"]
      : status === "active"
        ? ["Faollashgan", "bg-emerald-500/10 text-emerald-600"]
        : status === "invited"
          ? ["Taklif yuborilgan", "bg-amber-500/10 text-amber-600"]
          : [status, "bg-secondary text-muted-foreground"];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

/** Bugungi sana "YYYY-MM-DD" (input type=date uchun). */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "YYYY-MM-DD" → "DD.MM.YYYY" (loyihada saqlanadigan format). */
function toStoredDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export default function TempStaffPage() {
  const { showSuccess, showError } = useToast();
  const [rows, setRows] = useState<TempStaffRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [editTarget, setEditTarget] = useState<TempStaffRow | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", turi: "", email: "" });
  const [saving, setSaving] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<TempStaffRow | null>(null);
  const [archReason, setArchReason] = useState(EMP_LEAVE_REASONS[0]);
  const [archDate, setArchDate] = useState(todayIso());

  const [deleteTarget, setDeleteTarget] = useState<TempStaffRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── SMS ──────────────────────────────────────────────────────────────
  // Belgilangan xodimlar. Ro'yxat qayta yuklanganda ham saqlanadi, lekin
  // pastda MAVJUD qatorlar bilan kesiladi — o'chirilgan xodim tanlovda
  // osilib qolmasin.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [maxBatch, setMaxBatch] = useState(25);
  /**
   * Tasdiq oynasi (`null` = yopiq). `skipped` — tanlangan, lekin SMS
   * ketmaydigan xodimlar soni: ular ro'yxatda ko'rsatilsa "shu 25 taga
   * yuboriladi" degan yozuv yolg'on bo'lardi.
   */
  const [smsTargets, setSmsTargets] = useState<{ list: TempStaffRow[]; skipped: number } | null>(null);
  const [sending, setSending] = useState(false);
  /** Oxirgi yuborish natijasi — qatorlar kesimida (jimgina yo'qolmasin). */
  const [smsResults, setSmsResults] = useState<InviteResult[] | null>(null);

  // Bir marta yuklanadi. Filial almashtirilganda QAYTA so'ralmaydi — bu
  // ro'yxat ataylab qamrovsiz, ya'ni tanlangan filialga bog'liq emas.
  useEffect(() => {
    let cancelled = false;
    fetchList()
      .then((d) => {
        if (cancelled) return;
        if ("error" in d) {
          showError(d.error);
          return;
        }
        setRows(d.employees);
        setBranches(d.branches);
        setMaxBatch(d.maxBatch);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showError]);

  /** Amaldan keyin ro'yxatni yangilash (hodisa ishlovchisidan chaqiriladi). */
  async function reload() {
    const d = await fetchList();
    if ("error" in d) {
      showError(d.error);
      return;
    }
    setRows(d.employees);
    setBranches(d.branches);
    setMaxBatch(d.maxBatch);
    // Tanlovni MAVJUD qatorlar bilan kesamiz: o'chirilgan xodim tanlangan
    // bo'lib qolsa, "SMS yuborish" uni ro'yxatga qo'shib, serverdan
    // "Xodim topilmadi" olib kelardi.
    setSelected((prev) => {
      const alive = new Set(d.employees.map((e) => e.id));
      return new Set([...prev].filter((id) => alive.has(id)));
    });
  }

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  // Qidiruv ism, telefon, vazifa va filial nomi bo'yicha. Telefon ikkala
  // shaklda ham topilsin: bazada "998941558855", ekranda "+998 94 155 88 55",
  // foydalanuvchi esa "941558855" deb yozishi mumkin — shuning uchun
  // solishtirishdan oldin ikkala tomondan raqam bo'lmagan belgilar olinadi.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      const hay = [
        r.name,
        ROLE_LABELS[r.turi as keyof typeof ROLE_LABELS] ?? r.turi,
        r.email,
        ...r.branchIds.map((id) => branchName.get(id) ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      return qDigits.length > 0 && r.phone.replace(/\D/g, "").includes(qDigits);
    });
  }, [rows, query, branchName]);

  // ── Belgilash ────────────────────────────────────────────────────────
  // Sarlavhadagi galochka FILTRLANGAN qatorlar ustida ishlaydi: qidiruv
  // yoqiq turganda "hammasini belgilash" ekranda ko'rinmayotgan xodimni
  // ham tanlab qo'ysa, SMS kutilmagan odamga ketardi.
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleOne(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }
  function toggleAllFiltered(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) { if (on) next.add(r.id); else next.delete(r.id); }
      return next;
    });
  }

  // ── Faollashtirish SMS'i ─────────────────────────────────────────────
  // Bittalab yuborish ham, ko'plab yuborish ham SHU yo'ldan o'tadi —
  // farqi faqat ro'yxatning uzunligida. Ikkalasi ham tasdiq oynasini
  // ko'rsatadi: SMS haqiqatan ketadi va pul turadi.
  function askSend(targets: TempStaffRow[]) {
    if (targets.length === 0) {
      showError("Xodim tanlanmagan");
      return;
    }
    // Server ham shu ikkalasini rad etadi; bu yerda esa ular ro'yxatga
    // umuman kirmaydi — tasdiq oynasidagi son HAQIQATDA ketadigan SMS
    // soni bo'lishi kerak.
    const list = targets.filter((t) => t.accountStatus !== "active" && t.phone);
    if (list.length === 0) {
      showError("Tanlanganlarning hammasi faollashgan yoki raqamsiz — yuboriladigan SMS yo'q");
      return;
    }
    setSmsResults(null);
    setSmsTargets({ list, skipped: targets.length - list.length });
  }

  async function confirmSend() {
    if (!smsTargets) return;
    setSending(true);
    try {
      const res = await fetch("/api/temp-staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: smsTargets.list.map((t) => t.id) }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Yuborilmadi");
        return;
      }
      const results = data.results as InviteResult[];
      setSmsResults(results);
      setSmsTargets(null);
      if (data.failed === 0) {
        showSuccess(`SMS yuborildi — ${data.sent} ta`);
      } else {
        showError(`Yuborildi: ${data.sent}, yuborilmadi: ${data.failed} — sabablari pastda`);
      }
      await reload();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSending(false);
    }
  }

  /**
   * "Ikki bosqichli tasdiqlash" tugmachasi.
   *
   * Javobni KUTMASDAN jadvalni yangilaymiz (optimistik) — tugmacha
   * bosilishi bilan qimirlashi kerak; xato bo'lsa qaytariladi.
   */
  async function toggleTwoFactor(r: TempStaffRow, on: boolean) {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, twoFactor: on } : x)));
    try {
      const res = await fetch(`/api/temp-staff/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twoFactor: on }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Saqlanmadi");
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, twoFactor: !on } : x)));
      showError(e instanceof Error ? e.message : "Saqlanmadi");
    }
  }

  function openEdit(r: TempStaffRow) {
    setForm({
      name: r.name,
      phone: formatPhoneDisplay(r.phone),
      turi: r.turi,
      email: r.email,
    });
    setEditTarget(r);
  }

  async function saveEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) {
      showError("Ismni kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/temp-staff/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          turi: form.turi,
          email: form.email.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setEditTarget(null);
      showSuccess("Saqlandi");
      await reload();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  function openArchive(r: TempStaffRow) {
    setArchReason(EMP_LEAVE_REASONS[0]);
    setArchDate(todayIso());
    setArchiveTarget(r);
  }

  /** Arxivlash — sabab + sana yoziladi; qaytarish — ikkalasi tozalanadi. */
  async function saveArchive(restore: boolean) {
    if (!archiveTarget) return;
    const body = restore
      ? { archReason: "", archDate: "" }
      : { archReason, archDate: toStoredDate(archDate) };
    if (!restore && (!archReason || !body.archDate)) {
      showError("Sabab va sanani to'g'ri kiriting");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/temp-staff/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Saqlanmadi");
        return;
      }
      setArchiveTarget(null);
      showSuccess(restore ? "Arxivdan chiqarildi" : "Arxivlandi");
      await reload();
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/temp-staff/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "O'chirilmadi");
        return;
      }
      const r = data.removed as { users: number; sessions: number; codes: number };
      // Nima o'chganini AYTAMIZ: sahifaning maqsadi raqamni bo'shatish, va
      // "hisob o'chdimi?" degan savol javobsiz qolmasligi kerak.
      showSuccess(
        `O'chirildi — hisob: ${r.users}, sessiya: ${r.sessions}, SMS kodi: ${r.codes}. Raqam endi bo'sh.`,
      );
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch {
      showError("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-3 text-[13px] text-amber-700 dark:text-amber-400">
        <b>Vaqtinchalik bo&apos;lim.</b> To&apos;rtala filial xodimi bir ro&apos;yxatda. Bu yerdagi
        &laquo;O&apos;chirish&raquo; xodimni <b>butunlay</b> o&apos;chiradi — hisobi, sessiyalari va
        SMS kodlari bilan birga, ya&apos;ni telefon raqami qayta ishlatishga bo&apos;shaydi.
      </div>

      {/* Oxirgi yuborish natijasi. Toast o'chib ketadi, sabab esa kerak
          bo'lib turadi ("soatlik chegara", "raqam yo'q", "allaqachon
          faollashgan") — shu bois qatorlar kesimida shu yerda qoladi. */}
      {smsResults && (
        <div className="rounded-2xl border border-border bg-card px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold">
              SMS natijasi — yuborildi: {smsResults.filter((r) => r.ok).length}, yuborilmadi:{" "}
              {smsResults.filter((r) => !r.ok).length}
            </span>
            <button
              onClick={() => setSmsResults(null)}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Yopish
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {smsResults.map((r) => (
              <li key={r.id} className={r.ok ? "text-emerald-600" : "text-rose-600"}>
                {r.ok ? "✅" : "❌"} {r.name}
                {r.error ? ` — ${r.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, telefon, vazifa yoki filial"
                className={`${inputCls} pl-9`}
              />
            </div>
            <button
              onClick={() => askSend(rows.filter((r) => selected.has(r.id)))}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              title={selected.size === 0 ? "Avval xodimlarni belgilang" : undefined}
            >
              <Send className="w-4 h-4" />
              Tanlanganlarga SMS
              {selected.size > 0 && <span className="tabular-nums">({selected.size})</span>}
            </button>
            {selected.size > maxBatch && (
              <span className="text-[12px] text-rose-600">
                Bir marta {maxBatch} tagacha — belgilanganini kamaytiring
              </span>
            )}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Topildi:</span>
            <span className="tabular-nums">{filtered.length}</span>
            <span className="text-primary/60">/ {rows.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => toggleAllFiltered(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary align-middle"
                    title="Ko'rinib turgan qatorlarni belgilash"
                  />
                </th>
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">To&apos;liq nomi</th>
                <th className="px-5 py-3 text-left">Telefon</th>
                <th className="px-5 py-3 text-left">Vazifasi</th>
                <th className="px-5 py-3 text-left">Filiallar</th>
                <th className="px-5 py-3 text-left">Hisob</th>
                <th className="px-5 py-3 text-left">Holat</th>
                <th className="px-5 py-3 text-left w-28">2 bosqich</th>
                <th className="px-5 py-3 text-right pr-5 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r, i) => {
                const archived = Boolean(r.archReason);
                const done = r.accountStatus === "active";
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors ${selected.has(r.id) ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-primary align-middle"
                      />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-5 py-3 font-medium">{r.name || "-"}</td>
                    <td className="px-5 py-3 tabular-nums text-[13px]">{formatPhoneDisplay(r.phone) || "-"}</td>
                    <td className="px-5 py-3 text-[13px]">
                      {ROLE_LABELS[r.turi as keyof typeof ROLE_LABELS] ?? r.turi ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">
                      {r.branchIds.length === 0
                        ? "-"
                        : r.branchIds.map((id) => branchName.get(id) ?? `Filial ${id}`).join(", ")}
                    </td>
                    <td className="px-5 py-3">
                      <AccountBadge status={r.accountStatus} />
                    </td>
                    <td className="px-5 py-3">
                      {archived ? (
                        <span
                          className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          title={`${r.archReason}${r.archDate ? ` — ${r.archDate}` : ""}`}
                        >
                          Arxivda
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          Aktiv
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <EmployeeToggle
                        checked={r.twoFactor}
                        onChange={(v) => toggleTwoFactor(r, v)}
                        title="Ikki bosqichli tasdiqlash — saqlanadi, lekin login oqimi uni hozircha o'qimaydi"
                      />
                    </td>
                    <td className="px-5 py-3 pr-5">
                      <div className="flex items-center justify-end gap-1">
                        {/* Faollashtirish SMS'i — aynan shu qatordagi
                            xodimga. Faollashgan hisobga yubormaymiz: unda
                            parol allaqachon bor, havola hech narsa
                            bermaydi (server ham rad etadi). */}
                        <button
                          onClick={() => askSend([r])}
                          disabled={done}
                          className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                          title={done ? "Hisob allaqachon faollashgan" : "Faollashtirish SMS'ini yuborish"}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(r)}
                          className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                          title="Tahrirlash"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openArchive(r)}
                          className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                          title={archived ? "Arxivdan chiqarish" : "Arxivlash"}
                        >
                          {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="h-8 w-8 rounded-md hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center text-rose-500"
                          title="Butunlay o'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    {loading ? <SpinnerBlock size={22} /> : "Ma'lumotlar topilmadi"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <Dialog onClose={() => !saving && setEditTarget(null)} width="max-w-md">
          <h3 className="text-[16px] font-semibold">Xodimni tahrirlash</h3>
          <div>
            <label className={labelCls}>Ism familiya</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefon raqam</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={`${inputCls} tabular-nums`}
              placeholder="+998 90 123 45 67"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Raqam o&apos;zgarsa hisob ham ergashadi — xodim yangi raqami bilan kiradi.
            </p>
          </div>
          <div>
            <label className={labelCls}>O&apos;quv markazidagi vazifasi</label>
            <select
              value={form.turi}
              onChange={(e) => setForm((f) => ({ ...f, turi: e.target.value }))}
              className={inputCls}
            >
              <option value="">Tanlang</option>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label as string}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Elektron pochta</label>
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputCls}
              placeholder="example@gmail.com"
            />
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Filial, ish haqi, soliq va ruxsatlar bu yerda emas — ular Boshqaruv &rarr; Xodimlar
            sahifasida, bir-biriga bog&apos;liq qoidalar bilan birga tahrirlanadi.
          </p>
          <Actions
            onCancel={() => setEditTarget(null)}
            onOk={saveEdit}
            busy={saving}
            okLabel="Saqlash"
            busyLabel="Saqlanmoqda…"
          />
        </Dialog>
      )}

      {archiveTarget && (
        <Dialog onClose={() => !saving && setArchiveTarget(null)} width="max-w-md">
          <h3 className="text-[16px] font-semibold">
            {archiveTarget.archReason ? "Arxivdan chiqarish" : "Arxivlash"}
          </h3>
          {archiveTarget.archReason ? (
            <p className="text-[13px] text-muted-foreground">
              <b className="text-foreground">{archiveTarget.name}</b> arxivdan chiqariladi va yana
              aktiv xodimlar qatoriga qaytadi.
            </p>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                <b className="text-foreground">{archiveTarget.name}</b> arxivga o&apos;tkaziladi. U
                ro&apos;yxatdan yo&apos;qolmaydi va istalgan vaqtda qaytariladi.
              </p>
              <div>
                <label className={labelCls}>Ketish sababi</label>
                <select
                  value={archReason}
                  onChange={(e) => setArchReason(e.target.value)}
                  className={inputCls}
                >
                  {EMP_LEAVE_REASONS.map((r: string) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ketgan sanasi</label>
                <input
                  type="date"
                  value={archDate}
                  onChange={(e) => setArchDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}
          <Actions
            onCancel={() => setArchiveTarget(null)}
            onOk={() => saveArchive(Boolean(archiveTarget.archReason))}
            busy={saving}
            okLabel={archiveTarget.archReason ? "Arxivdan chiqarish" : "Arxivlash"}
            busyLabel="Saqlanmoqda…"
          />
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog onClose={() => !deleting && setDeleteTarget(null)} width="max-w-md">
          <h3 className="text-[16px] font-semibold text-rose-600">Butunlay o&apos;chirish</h3>
          <p className="text-[13px]">
            <b>{deleteTarget.name}</b> — {formatPhoneDisplay(deleteTarget.phone)}
          </p>
          {/* Aynan nima o'chishi ro'yxat bo'lib turadi: bu amal qaytarilmaydi
              va "faqat jadvaldan yo'qoladi" deb o'ylash mumkin edi. */}
          <ul className="text-[12.5px] text-muted-foreground list-disc pl-5 space-y-1">
            <li>xodim yozuvi</li>
            <li>hisobi (shu raqamni band qilib turgani)</li>
            <li>ochiq sessiyalari</li>
            <li>faollashtirish SMS kodlari (soatlik chegara ham bo&apos;shaydi)</li>
          </ul>
          <p className="text-[12.5px] text-muted-foreground">
            Shundan keyin bu raqam bilan yangi xodim qo&apos;shsa bo&apos;ladi. Amal qaytarilmaydi.
          </p>
          <Actions
            onCancel={() => setDeleteTarget(null)}
            onOk={confirmDelete}
            busy={deleting}
            okLabel="Ha, o'chirilsin"
            busyLabel="O'chirilmoqda…"
            danger
          />
        </Dialog>
      )}

      {smsTargets && (
        <Dialog onClose={() => !sending && setSmsTargets(null)} width="max-w-md">
          <h3 className="text-[16px] font-semibold">Faollashtirish SMS&apos;i</h3>
          {/* KIMGA ketishi ochiq ro'yxat bilan turadi. SMS haqiqatan
              yuboriladi va pul turadi — "N ta xodimga" degan mavhum son
              bilan tasdiqlatish xatoni ko'rinmas qilardi. */}
          <p className="text-[13px] text-muted-foreground">
            Quyidagi <b className="text-foreground">{smsTargets.list.length} ta</b> raqamga
            faollashtirish havolasi va kodi yuboriladi:
          </p>
          <ul className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border text-[13px]">
            {smsTargets.list.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate">{t.name || `#${t.id}`}</span>
                <span className="tabular-nums text-muted-foreground">{formatPhoneDisplay(t.phone)}</span>
              </li>
            ))}
          </ul>
          {smsTargets.skipped > 0 && (
            <p className="text-[12px] text-amber-600">
              Yana {smsTargets.skipped} ta tanlangan xodim ro&apos;yxatga kirmadi — hisobi
              allaqachon faollashgan yoki telefon raqami yo&apos;q.
            </p>
          )}
          <p className="text-[12px] text-muted-foreground">
            SMS haqiqatan yuboriladi. Bitta raqamga soatiga 5 tadan ko&apos;p kod ketmaydi.
          </p>
          <Actions
            onCancel={() => setSmsTargets(null)}
            onOk={confirmSend}
            busy={sending}
            okLabel="Yuborish"
            busyLabel="Yuborilmoqda…"
          />
        </Dialog>
      )}
    </div>
  );
}

/** Loyihadagi oddiy modal qolipi (fon bosilsa yopiladi, Esc ham). */
function Dialog({
  children,
  onClose,
  width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width: string;
}) {
  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${width} rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
}

function Actions({
  onCancel,
  onOk,
  busy,
  okLabel,
  busyLabel,
  danger = false,
}: {
  onCancel: () => void;
  onOk: () => void;
  busy: boolean;
  okLabel: string;
  busyLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        onClick={onCancel}
        disabled={busy}
        className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium disabled:opacity-60"
      >
        Bekor qilish
      </button>
      <button
        onClick={onOk}
        disabled={busy}
        className={`h-10 px-5 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 ${
          danger ? "bg-rose-600" : "bg-primary"
        }`}
      >
        {busy ? busyLabel : okLabel}
      </button>
    </div>
  );
}
